import Video from '../models/Video.js';
import { 
  validateVideoFile, 
  getFileInfo, 
  estimateVideoMetadata, 
  simulateContentAnalysis,
  createProcessingSteps,
  delay 
} from '../utils/videoUtils.js';




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

    console.log(`Video ${videoId}: ${progress}% - ${message}`);
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

// Main processing function - simple and functional
export const processVideo = async (videoId, io) => {
  let video;

  try {
    // Get video from database
    video = await Video.findById(videoId);
    if (!video) {
      console.error(`Video ${videoId} not found`);
      return;
    }

    console.log(`Starting processing for video ${videoId}`);
    
    const userId = video.uploadedBy;
    const filePath = video.filePath;
    const steps = createProcessingSteps();

    // Step 1: Initialize
    await updateVideoProgress(videoId, steps[0].progress, steps[0].message, 'processing', io, userId);
    await delay(500);

    // Step 2: Validate file
    await updateVideoProgress(videoId, steps[1].progress, steps[1].message, 'processing', io, userId);
    
    if (!validateVideoFile(filePath)) {
      throw new Error('Video file not found or invalid');
    }
    
    await delay(800);

    // Step 3: Extract basic info and metadata
    await updateVideoProgress(videoId, steps[2].progress, steps[2].message, 'processing', io, userId);
    
    const fileInfo = getFileInfo(filePath);
    if (!fileInfo.isValid) {
      throw new Error(`File info extraction failed: ${fileInfo.error}`);
    }

    const metadata = estimateVideoMetadata(fileInfo);
    
    // Update video with metadata
    await Video.findByIdAndUpdate(videoId, {
      duration: metadata.duration,
      fileSize: fileInfo.size,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        quality: metadata.quality,
        estimatedBitrate: metadata.estimatedBitrate,
        format: fileInfo.extension.replace('.', '')
      }
    });

    await delay(1200);

    // Step 4: Analyze content
    await updateVideoProgress(videoId, steps[3].progress, steps[3].message, 'processing', io, userId);
    
    const contentAnalysis = simulateContentAnalysis();
    
    // Update video with analysis results
    await Video.findByIdAndUpdate(videoId, {
      sensitivityScore: contentAnalysis.score,
      sensitivityStatus: contentAnalysis.status,
      processedAt: new Date()
    });

    await delay(1000);

    // Step 5: Finalize
    await updateVideoProgress(videoId, steps[4].progress, steps[4].message, 'processing', io, userId);
    await delay(500);

    // Step 6: Complete
    await updateVideoProgress(videoId, steps[5].progress, steps[5].message, 'completed', io, userId);

    // Send completion notification
    if (io && userId) {
      io.to(`user-${userId}`).emit('videoProcessed', {
        videoId,
        status: 'completed',
        metadata,
        contentAnalysis,
        completedAt: new Date()
      });
    }

    console.log(`Successfully processed video ${videoId}`);

  } catch (error) {
    console.error(`Processing failed for video ${videoId}:`, error);
    await markVideoAsFailed(videoId, error, io, video?.uploadedBy);
  }
};