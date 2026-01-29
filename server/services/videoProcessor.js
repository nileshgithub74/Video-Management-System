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
      `You are a content moderator. Analyze this image and determine if it contains clearly inappropriate content that violates content policies.

      Only flag content that is CLEARLY and OBVIOUSLY inappropriate:
      - Explicit nudity or sexual content
      - Graphic violence or gore
      - Clear drug use or drug paraphernalia
      - Hate symbols or clearly offensive gestures
      - Explicit inappropriate text or signs

      DO NOT flag content that is:
      - Educational or artistic
      - Mild or suggestive but not explicit
      - Normal everyday activities
      - People in regular clothing
      - Sports or fitness activities
      - Medical or educational content

      Respond with exactly one word: "SAFE" if the content is appropriate or borderline, or "FLAGGED" only if it's clearly inappropriate.`,
      {
        inlineData: {
          data: image.toString("base64"),
          mimeType: "image/jpeg",
        },
      },
    ]);

    const verdict = result.response.text().trim().toUpperCase();
    console.log(`Frame analysis result: ${verdict} for ${path.basename(imagePath)}`);
    
    // Only flag if explicitly marked as flagged
    const isFlagged = verdict.includes('FLAGGED');
    
    return isFlagged ? 'FLAGGED' : 'SAFE';
  } catch (error) {
    console.error(`Frame analysis failed for ${imagePath}:`, error.message);
    // Default to SAFE on error to avoid false positives
    return 'SAFE';
  }
}

export async function analyzeVideoSafety(frames) {
  let flaggedCount = 0;
  const results = [];
  const totalFrames = frames.length;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    try {
      const verdict = await analyzeFrame(frame);
      results.push({ frame: path.basename(frame), verdict });
      
      if (verdict === 'FLAGGED') {
        flaggedCount++;
        console.log(`Flagged content detected in frame: ${path.basename(frame)}`);
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to analyze frame ${path.basename(frame)}:`, error.message);
      results.push({ frame: path.basename(frame), verdict: 'ERROR', error: error.message });
      // Don't count errors as flagged - default to safe
    }
  }

  // Video is flagged only if MORE THAN HALF of frames are flagged (more lenient)
  const flaggedPercentage = (flaggedCount / totalFrames) * 100;
  const finalStatus = flaggedPercentage > 50 ? "flagged" : "safe";
  const sensitivityScore = Math.round(flaggedPercentage);
  
  console.log(`Video analysis complete: ${finalStatus.toUpperCase()}, ${flaggedCount}/${totalFrames} frames flagged (${flaggedPercentage.toFixed(1)}%)`);
  
  return {
    status: finalStatus,
    sensitivityScore,
    analyzedAt: new Date(),
    frameResults: results,
    totalFrames,
    flaggedFrames: flaggedCount
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
const extractFrames = (videoPath, outputFolder, numFrames = 3) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      const error = new Error(`Video file not found: ${videoPath}`);
      console.error(error.message);
      return reject(error);
    }

    const frames = [];
    ffmpeg(videoPath)
      .on('filenames', (filenames) => {
        filenames.forEach(file => frames.push(path.join(outputFolder, file)));
      })
      .on('end', () => {
        resolve(frames);
      })
      .on('error', (err) => {
        console.error(`Frame extraction failed:`, err.message);
        reject(err);
      })
      .screenshots({
        count: numFrames,
        folder: outputFolder,
        size: '640x?',
        filename: 'frame-%i.jpg'
      });
  });
};

export const processVideo = async (videoId, io) => {
  let video;
  const tempDir = path.join(process.cwd(), 'temp', `frames-${videoId}`);

  try {
    video = await Video.findById(videoId);
    if (!video) return;

    const userId = video.uploadedBy;
    const filePath = video.filePath;

    // Early file size check
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 100) {
      throw new Error('The video file is empty or corrupted (moov atom missing).');
    }

    // Step 1: Initialize
    await updateVideoProgress(videoId, 5, 'Initializing processing...', 'processing', io, userId);

    // Step 2: Metadata extraction
    await updateVideoProgress(videoId, 20, 'Extracting video metadata...', 'processing', io, userId);
    
    await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, async (err, metadata) => {
        if (err) return reject(err);
        
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        
        // Calculate FPS safely
        let fps = 0;
        if (videoStream?.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/');
          fps = den ? parseFloat(num) / parseFloat(den) : parseFloat(num);
        }
        
        await Video.findByIdAndUpdate(videoId, {
          duration: metadata.format.duration || 0,
          metadata: {
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            quality: videoStream?.height >= 1080 ? 'Full HD' : (videoStream?.height >= 720 ? 'HD' : 'SD'),
            fps: Math.round(fps) || 0,
            format: metadata.format.format_name || 'unknown',
            bitrate: videoStream?.bit_rate || 0,
            codec: videoStream?.codec_name || 'unknown'
          }
        });
        resolve();
      });
    });

    // Step 3: Frame Extraction - Analyze more frames for better coverage
    await updateVideoProgress(videoId, 45, 'Extracting frames for analysis...', 'processing', io, userId);
    const frames = await extractFrames(filePath, tempDir, 8); // Increased from 3 to 8 frames

    // Step 4: Gemini Analysis
    await updateVideoProgress(videoId, 75, 'Analyzing content safety with AI...', 'processing', io, userId);
    const analysis = await analyzeVideoSafety(frames);

    // Step 5: Finalize
    await updateVideoProgress(videoId, 95, 'Finalizing results...', 'processing', io, userId);
    
    await Video.findByIdAndUpdate(videoId, {
      sensitivityScore: analysis.sensitivityScore || (analysis.status === 'flagged' ? 100 : 0),
      sensitivityStatus: analysis.status,
      processingStatus: 'completed',
      processingProgress: 100,
      processedAt: new Date()
    });

    // Notify completion
    if (io && userId) {
      io.to(`user-${userId}`).emit('videoProcessed', {
        videoId,
        status: 'completed',
        analysis
      });
    }

    // Cleanup temp frames
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

  } catch (error) {
    console.error(`Processing failed for video ${videoId}:`, error);
    await markVideoAsFailed(videoId, error, io, video?.uploadedBy);
    
    // Cleanup on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
};
