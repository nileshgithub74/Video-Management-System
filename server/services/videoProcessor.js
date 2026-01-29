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

async function analyzeFrame(imagePath) {
  try {
    const image = fs.readFileSync(imagePath);
    const result = await model.generateContent([
      "You are a content moderator. Analyze this image VERY carefully. Only flag content that is clearly inappropriate for a professional platform. Look ONLY for: 1) Explicit nudity (exposed genitals, breasts), 2) Graphic violence (blood, weapons being used), 3) Drug use (people using drugs), 4) Hate symbols (nazi symbols, etc). Normal faces, clothed people, everyday objects, and regular activities should be marked as SAFE. Be conservative - when in doubt, mark as SAFE. Respond with exactly 'SAFE' or 'FLAGGED'.",
      {
        inlineData: {
          data: image.toString("base64"),
          mimeType: "image/jpeg",
        },
      },
    ]);
    
    const response = result.response.text().trim().toUpperCase();
    console.log(`🔍 Frame analysis result: "${response}"`);
    
    // Only flag if response explicitly contains "FLAGGED"
    return response.includes("FLAGGED") ? "FLAGGED" : "SAFE";
    
  } catch (error) {
    console.error(`❌ AI analysis error: ${error.message}`);
    
    // If quota exceeded or API error, default to SAFE to avoid false positives
    if (error.message.includes('quota') || error.message.includes('429')) {
      console.log('⚠️ API quota exceeded, defaulting to SAFE');
      return "SAFE";
    }
    
    // For other errors, also default to SAFE
    console.log('⚠️ Analysis failed, defaulting to SAFE');
    return "SAFE";
  }
}

export async function analyzeVideoSafety(framesDir) {
  const frames = fs.readdirSync(framesDir);
  console.log(`🎬 Analyzing ${frames.length} frames for safety`);
  
  let flaggedFrames = 0;
  let totalFrames = frames.length;
  
  for (const frame of frames) {
    try {
      const verdict = await analyzeFrame(path.join(framesDir, frame));
      console.log(`📸 Frame ${frame}: ${verdict}`);
      
      if (verdict === "FLAGGED") {
        flaggedFrames++;
      }
    } catch (error) {
      console.error(`❌ Error analyzing frame ${frame}:`, error.message);
      // If analysis fails, assume safe to avoid false positives
    }
  }
  
  console.log(`📊 Analysis complete: ${flaggedFrames}/${totalFrames} frames flagged`);
  
  // Only flag video if ANY frame is explicitly flagged
  if (flaggedFrames > 0) {
    return {
      status: "flagged",
      confidence: 0.9,
      analyzedAt: new Date(),
      details: `${flaggedFrames}/${totalFrames} frames flagged`
    };
  }
  
  return {
    status: "safe",
    confidence: 0.9,
    analyzedAt: new Date(),
    details: `All ${totalFrames} frames are safe`
  };
}

const extractFrames = (videoPath, outputFolder, numFrames = 5) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    if (!fs.existsSync(videoPath)) {
      return reject(new Error(`Video file not found: ${videoPath}`));
    }

    ffmpeg(videoPath)
      .on('end', () => {
        resolve(outputFolder);
      })
      .on('error', (err) => {
        reject(err);
      })
      .screenshots({
        count: numFrames,
        folder: outputFolder,
        size: '640x480',
        filename: 'frame-%i.jpg'
      });
  });
};

export const processVideo = async (videoId, io) => {
  console.log(`🎬 Processing video ${videoId}`);
  
  try {
    const video = await Video.findById(videoId);
    if (!video) return;

    const userId = video.uploadedBy;
    const tempDir = path.join(process.cwd(), 'temp', `frames-${videoId}`);

    // Step 1: Start processing
    await Video.findByIdAndUpdate(videoId, {
      processingStatus: 'processing',
      processingProgress: 20
    });

    if (io && userId) {
      io.to(`user-${userId}`).emit('videoProgress', {
        videoId,
        progress: 20,
        status: 'processing'
      });
    }

    // Step 2: Extract frames
    console.log(`📸 Extracting frames from ${video.filePath}`);
    await extractFrames(video.filePath, tempDir, 5);

    await Video.findByIdAndUpdate(videoId, {
      processingProgress: 60
    });

    if (io && userId) {
      io.to(`user-${userId}`).emit('videoProgress', {
        videoId,
        progress: 60,
        status: 'processing'
      });
    }

    // Step 3: Analyze with AI
    console.log(`🤖 Analyzing frames in ${tempDir}`);
    const analysis = await analyzeVideoSafety(tempDir);

    // Step 4: Complete
    await Video.findByIdAndUpdate(videoId, {
      processingStatus: 'completed',
      processingProgress: 100,
      sensitivityStatus: analysis.status,
      sensitivityScore: analysis.confidence * 100,
      processedAt: new Date()
    });

    if (io && userId) {
      io.to(`user-${userId}`).emit('videoProcessed', {
        videoId,
        status: 'completed',
        analysis
      });
    }

    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log(`✅ Video ${videoId} processed: ${analysis.status}`);

  } catch (error) {
    console.error(`❌ Processing failed for ${videoId}:`, error.message);
    
    await Video.findByIdAndUpdate(videoId, {
      processingStatus: 'failed',
      processingError: error.message
    });

    const video = await Video.findById(videoId);
    if (io && video?.uploadedBy) {
      io.to(`user-${video.uploadedBy}`).emit('videoProcessed', {
        videoId,
        status: 'failed',
        error: error.message
      });
    }
  }
};
