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
 * Basic Gemini Vision Check Code
 */
export async function analyzeFrame(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Frame file not found: ${imagePath}`);
    }

    const image = fs.readFileSync(imagePath);

    const result = await model.generateContent([
      "Is this image unsafe (nudity, violence, drugs, hate)? Reply SAFE or FLAGGED only.",
      {
        inlineData: {
          data: image.toString("base64"),
          mimeType: "image/jpeg",
        },
      },
    ]);

    const verdict = result.response.text().trim();
    return verdict;
  } catch (error) {
    console.error(`Frame analysis failed for ${imagePath}:`, error.message);
    throw error;
  }
}

export async function analyzeVideoSafety(frames) {
  let flagged = false;
  const results = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    try {
      const verdict = await analyzeFrame(frame);
      results.push({ frame: path.basename(frame), verdict });
      
      if (verdict.includes("FLAGGED")) {
        flagged = true;
        console.log(`Flagged content detected in frame: ${path.basename(frame)}`);
      }
    } catch (error) {
      console.error(`Failed to analyze frame ${path.basename(frame)}:`, error.message);
      results.push({ frame: path.basename(frame), verdict: 'ERROR', error: error.message });
    }
  }

  const finalStatus = flagged ? "flagged" : "safe";
  
  return {
    status: finalStatus,
    analyzedAt: new Date(),
    frameResults: results,
    totalFrames: frames.length,
    flaggedFrames: results.filter(r => r.verdict.includes('FLAGGED')).length
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

const markVideoAsFailed = async (videoId, error, io, userId) => {
  try {
    await Video.findByIdAndUpdate(videoId, {
      processingStatus: 'failed',
      processingProgress: 0,
      processingError: error.message
    });

    if (io && userId) {
      io.to(`user-${userId}`).emit('videoProcessed', {
        videoId,
        status: 'failed',
        error: error.message
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

    // Step 3: Frame Extraction
    await updateVideoProgress(videoId, 45, 'Extracting frames for analysis...', 'processing', io, userId);
    const frames = await extractFrames(filePath, tempDir, 3);

    // Step 4: Gemini Analysis
    await updateVideoProgress(videoId, 75, 'Analyzing content safety with AI...', 'processing', io, userId);
    const analysis = await analyzeVideoSafety(frames);

    // Step 5: Finalize
    await updateVideoProgress(videoId, 95, 'Finalizing results...', 'processing', io, userId);
    
    await Video.findByIdAndUpdate(videoId, {
      sensitivityScore: analysis.status === 'flagged' ? 100 : 0,
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
