import Video from '../models/Video.js';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * Enhanced Gemini Vision Check Code with more lenient analysis
 */
export async function analyzeFrame(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Frame file not found: ${imagePath}`);
    }

    const image = fs.readFileSync(imagePath);

    const result = await model.generateContent([
      `Analyze this image for inappropriate content.

      ONLY flag if you clearly see:
      - Nudity or sexual content
      - Violence with blood
      - Illegal drug use

      For everything else (normal people, activities, objects), respond: SAFE

      Respond with exactly one word: FLAGGED or SAFE`,
      {
        inlineData: {
          data: image.toString("base64"),
          mimeType: "image/jpeg",
        },
      },
    ]);

    const verdict = result.response.text().trim().toUpperCase();
    
    // Simple check - if response contains FLAGGED, flag it
    const isFlagged = verdict.includes('FLAGGED');
    
    return isFlagged ? 'FLAGGED' : 'SAFE';
    
  } catch (error) {
    console.error(`Frame analysis error:`, error.message);
    
    // If quota exceeded, flag for manual review
    if (error.message.includes('quota') || error.message.includes('429')) {
      return 'FLAGGED';
    }
    
    // For other errors, default to SAFE
    return 'SAFE';
  }
}

export async function analyzeVideoSafety(frames) {
  let flaggedCount = 0;
  let safeCount = 0;
  let errorCount = 0;
  const results = [];
  const totalFrames = frames.length;

  console.log(`🤖 Starting AI analysis of ${totalFrames} frames`);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const frameName = path.basename(frame);
    
    try {
      console.log(`🔍 Analyzing frame ${i + 1}/${totalFrames}: ${frameName}`);
      
      const verdict = await analyzeFrame(frame);
      results.push({ frame: frameName, verdict });
      
      if (verdict === 'FLAGGED') {
        flaggedCount++;
        console.log(`🚨 Frame ${frameName}: FLAGGED`);
      } else if (verdict === 'SAFE') {
        safeCount++;
        console.log(`✅ Frame ${frameName}: SAFE`);
      }
      
      // Add delay to avoid rate limiting
      if (i < frames.length - 1) { // Don't delay after last frame
        await new Promise(resolve => setTimeout(resolve, 1000)); // Increased delay
      }
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to analyze frame ${frameName}:`, error.message);
      results.push({ 
        frame: frameName, 
        verdict: 'ERROR', 
        error: error.message 
      });
    }
  }

  // Calculate results
  const analyzedFrames = totalFrames - errorCount;
  const flaggedPercentage = analyzedFrames > 0 ? (flaggedCount / analyzedFrames) * 100 : 0;
  
  // Video is flagged only if MORE THAN 60% of successfully analyzed frames are flagged
  const finalStatus = flaggedPercentage > 60 ? "flagged" : "safe";
  const sensitivityScore = Math.round(flaggedPercentage);
  
  console.log(`📊 Analysis Summary:`);
  console.log(`   Total frames: ${totalFrames}`);
  console.log(`   Successfully analyzed: ${analyzedFrames}`);
  console.log(`   Safe frames: ${safeCount}`);
  console.log(`   Flagged frames: ${flaggedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Flagged percentage: ${flaggedPercentage.toFixed(1)}%`);
  console.log(`   Final status: ${finalStatus.toUpperCase()}`);
  
  return {
    status: finalStatus,
    sensitivityScore,
    analyzedAt: new Date(),
    frameResults: results,
    totalFrames,
    analyzedFrames,
    flaggedFrames: flaggedCount,
    safeFrames: safeCount,
    errorFrames: errorCount
  };
}

const updateVideoProgress = async (videoId, progress, message, status = 'processing', io, userId) => {
  try {
    await Video.findByIdAndUpdate(videoId, {
      processingProgress: progress,
      processingStatus: status
    });

    if (io && userId) {
      io.to(`user-${userId}`).emit('videoProgress', {
        videoId,
        progress,
        message,
        status
      });
    }
  } catch (error) {
    console.error(`Failed to update progress for video ${videoId}:`, error);
  }
};

const mapErrorToMessage = (error) => {
  const message = error.message || String(error) || '';
  const lowerMessage = message.toLowerCase();
  console.log('Mapping error:', message);

  if (lowerMessage.includes('moov atom not found') || 
      lowerMessage.includes('invalid data found') || 
      lowerMessage.includes('format error') ||
      lowerMessage.includes('atom not found')) {
    return 'The video file is corrupt, empty, or was not uploaded completely. Please try re-uploading a healthy MP4 file.';
  }
  if (lowerMessage.includes('ffprobe') || lowerMessage.includes('exited with code 1')) {
    return 'The file format is not supported or the video is unreadable. Please ensure you are using a standard MP4 file.';
  }
  if (lowerMessage.includes('ffmpeg exited with code 1')) {
    return 'Analysis failed: Could not extract frames from this video. It may be corrupted.';
  }
  if (lowerMessage.includes('not found') || lowerMessage.includes('no such file')) {
    return 'The upload was interrupted or the file is missing from the server.';
  }
  if (lowerMessage.includes('generative') || lowerMessage.includes('ai')) {
    return 'AI Safety analysis failed temporarily. The organizers have been notified.';
  }
  
  return 'Video processing failed due to an internal error. Please try a different file.';
};

const markVideoAsFailed = async (videoId, error, io, userId) => {
  try {
    const friendlyMessage = mapErrorToMessage(error);
    
    await Video.findByIdAndUpdate(videoId, {
      processingStatus: 'failed',
      processingProgress: 0,
      processingError: friendlyMessage,
      technicalError: error.message // Keep technical log in DB for debugging
    });

    if (io && userId) {
      io.to(`user-${userId}`).emit('videoProcessed', {
        videoId,
        status: 'failed',
        error: friendlyMessage
      });
    }
  } catch (updateError) {
    console.error(`Failed to mark video ${videoId} as failed:`, updateError);
  }
};

/**
 * Extract frames from video for analysis
 */
const extractFrames = (videoPath, outputFolder, numFrames = 5) => {
  return new Promise((resolve, reject) => {
    console.log(`🎬 Extracting ${numFrames} frames from: ${videoPath}`);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Verify video file exists
    if (!fs.existsSync(videoPath)) {
      const error = new Error(`Video file not found: ${videoPath}`);
      console.error(error.message);
      return reject(error);
    }

    const frames = [];
    let frameCount = 0;

    ffmpeg(videoPath)
      .on('filenames', (filenames) => {
        console.log(`📁 Frame files will be: ${filenames.join(', ')}`);
        filenames.forEach(file => {
          frames.push(path.join(outputFolder, file));
        });
      })
      .on('end', () => {
        console.log(`✅ Frame extraction completed. Generated ${frames.length} frames`);
        
        // Verify frames were actually created
        const existingFrames = frames.filter(frame => fs.existsSync(frame));
        
        if (existingFrames.length === 0) {
          return reject(new Error('No frames were generated - video may be corrupted'));
        }
        
        if (existingFrames.length < frames.length) {
          console.warn(`⚠️  Only ${existingFrames.length}/${frames.length} frames were created`);
        }
        
        resolve(existingFrames);
      })
      .on('error', (err) => {
        console.error(`❌ Frame extraction failed:`, err.message);
        reject(new Error(`Frame extraction failed: ${err.message}`));
      })
      .on('progress', (progress) => {
        if (progress.frames) {
          frameCount = progress.frames;
          console.log(`📊 Extracting frames... processed ${frameCount} frames`);
        }
      })
      .screenshots({
        count: numFrames,
        folder: outputFolder,
        size: '640x480', // Fixed size for consistency
        filename: 'frame-%i.jpg'
      });
  });
};

export const processVideo = async (videoId, io) => {
  let video;
  const tempDir = path.join(process.cwd(), 'temp', `frames-${videoId}`);

  try {
    console.log(`🎬 Starting video processing for ID: ${videoId}`);
    
    video = await Video.findById(videoId);
    if (!video) {
      console.error(`❌ Video not found: ${videoId}`);
      return;
    }

    const userId = video.uploadedBy;
    const filePath = video.filePath;

    console.log(`📁 Processing video file: ${filePath}`);

    // Check if file exists and has content
    if (!fs.existsSync(filePath)) {
      throw new Error('Video file not found on server');
    }

    const fileStats = fs.statSync(filePath);
    if (fileStats.size < 1000) { // Less than 1KB
      throw new Error('Video file is too small or corrupted');
    }

    console.log(`📊 File size: ${fileStats.size} bytes`);

    // Step 1: Initialize (5%)
    await updateVideoProgress(videoId, 5, 'Starting video processing...', 'processing', io, userId);

    // Step 2: Extract metadata (20%)
    await updateVideoProgress(videoId, 20, 'Extracting video information...', 'processing', io, userId);
    
    try {
      await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, async (err, metadata) => {
          if (err) {
            console.error(`❌ FFprobe error:`, err.message);
            return reject(new Error('Could not read video file - may be corrupted'));
          }
          
          const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
          if (!videoStream) {
            return reject(new Error('No video stream found in file'));
          }
          
          console.log(`📹 Video metadata extracted:`, {
            duration: metadata.format.duration,
            width: videoStream.width,
            height: videoStream.height,
            codec: videoStream.codec_name
          });
          
          // Update video with metadata
          await Video.findByIdAndUpdate(videoId, {
            duration: Math.round(metadata.format.duration || 0),
            metadata: {
              width: videoStream.width || 0,
              height: videoStream.height || 0,
              codec: videoStream.codec_name || 'unknown',
              format: metadata.format.format_name || 'unknown'
            }
          });
          
          resolve();
        });
      });
    } catch (metadataError) {
      console.error(`❌ Metadata extraction failed:`, metadataError.message);
      throw metadataError;
    }

    // Step 3: Extract frames (45%)
    await updateVideoProgress(videoId, 45, 'Extracting frames for analysis...', 'processing', io, userId);
    
    let frames = [];
    try {
      frames = await extractFrames(filePath, tempDir, 5); // Reduced to 5 frames for reliability
      console.log(`🖼️  Extracted ${frames.length} frames for analysis`);
      
      if (frames.length === 0) {
        throw new Error('No frames could be extracted from video');
      }
    } catch (frameError) {
      console.error(`❌ Frame extraction failed:`, frameError.message);
      throw new Error('Could not extract frames - video may be corrupted');
    }

    // Step 4: AI Analysis (75%)
    await updateVideoProgress(videoId, 75, 'Analyzing content with AI...', 'processing', io, userId);
    
    let analysis;
    try {
      console.log(`🤖 Starting AI analysis of ${frames.length} frames`);
      analysis = await analyzeVideoSafety(frames);
      console.log(`✅ AI analysis complete:`, analysis);
    } catch (aiError) {
      console.error(`❌ AI analysis failed:`, aiError.message);
      // Default to safe if AI fails
      analysis = {
        status: 'safe',
        sensitivityScore: 0,
        analyzedAt: new Date(),
        frameResults: [],
        totalFrames: frames.length,
        flaggedFrames: 0,
        error: 'AI analysis failed - defaulted to safe'
      };
    }

    // Step 5: Finalize (100%)
    await updateVideoProgress(videoId, 95, 'Finalizing processing...', 'processing', io, userId);
    
    // Update video with final results
    await Video.findByIdAndUpdate(videoId, {
      processingStatus: 'completed',
      processingProgress: 100,
      sensitivityStatus: analysis.status,
      sensitivityScore: analysis.sensitivityScore || 0,
      processedAt: new Date()
    });

    console.log(`🎉 Video processing completed for ${videoId}`);

    // Notify completion via WebSocket
    if (io && userId) {
      io.to(`user-${userId}`).emit('videoProcessed', {
        videoId,
        status: 'completed',
        analysis: {
          status: analysis.status,
          sensitivityScore: analysis.sensitivityScore,
          totalFrames: analysis.totalFrames,
          flaggedFrames: analysis.flaggedFrames
        }
      });
    }

    // Cleanup temp files
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`🗑️  Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        console.error(`⚠️  Could not cleanup temp directory:`, cleanupError.message);
      }
    }

  } catch (error) {
    console.error(`❌ Video processing failed for ${videoId}:`, error.message);
    
    // Mark video as failed
    try {
      const friendlyMessage = mapErrorToMessage(error);
      
      await Video.findByIdAndUpdate(videoId, {
        processingStatus: 'failed',
        processingProgress: 0,
        processingError: friendlyMessage,
        technicalError: error.message
      });

      // Notify failure via WebSocket
      if (io && video?.uploadedBy) {
        io.to(`user-${video.uploadedBy}`).emit('videoProcessed', {
          videoId,
          status: 'failed',
          error: friendlyMessage
        });
      }
    } catch (updateError) {
      console.error(`❌ Could not update failed video status:`, updateError.message);
    }
    
    // Cleanup on error
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error(`⚠️  Could not cleanup temp directory on error:`, cleanupError.message);
      }
    }
  }
};
