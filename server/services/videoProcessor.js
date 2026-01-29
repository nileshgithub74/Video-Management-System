import Video from '../models/Video.js';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Basic Gemini Vision Check Code
 */
export async function analyzeFrame(imagePath) {
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

  return result.response.text().trim();
}

export async function analyzeVideoSafety(frames) {
  let flagged = false;

  for (const frame of frames) {
    const verdict = await analyzeFrame(frame);
    if (verdict.includes("FLAGGED")) {
      flagged = true;
      break;
    }
  }

  return {
    status: flagged ? "flagged" : "safe",
    analyzedAt: new Date(),
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

    const frames = [];
    ffmpeg(videoPath)
      .on('filenames', (filenames) => {
        filenames.forEach(file => frames.push(path.join(outputFolder, file)));
      })
      .on('end', () => resolve(frames))
      .on('error', (err) => reject(err))
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
        await Video.findByIdAndUpdate(videoId, {
          duration: metadata.format.duration,
          fileSize: metadata.format.size,
          metadata: {
            width: videoStream?.width,
            height: videoStream?.height,
            quality: videoStream?.height >= 1080 ? 'Full HD' : (videoStream?.height >= 720 ? 'HD' : 'SD'),
            fps: eval(videoStream?.r_frame_rate),
            format: metadata.format.format_name
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
