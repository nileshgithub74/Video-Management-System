import mongoose from 'mongoose';
import Video from './models/Video.js';
import User from './models/User.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function fixVideo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const videoId = '697b3ab84d97acff1e694e11';
    console.log('Fixing video ID:', videoId);

    // Update the video to be public and ensure it's properly configured
    const video = await Video.findByIdAndUpdate(
      videoId,
      {
        isPublic: true, // Make it public so viewers can see it
        processingStatus: 'completed', // Ensure it's marked as completed
        sensitivityStatus: 'safe', // Mark as safe
        sensitivityScore: 0,
        processingProgress: 100
      },
      { new: true }
    ).populate('uploadedBy', 'username email role');

    if (video) {
      console.log('✅ Video updated successfully:');
      console.log('Title:', video.title);
      console.log('Status:', video.processingStatus);
      console.log('Sensitivity:', video.sensitivityStatus);
      console.log('Public:', video.isPublic);
      console.log('File Path:', video.filePath);
      
      // Check if the video file exists
      const fileExists = fs.existsSync(video.filePath);
      console.log('File exists on server:', fileExists);
      
      if (fileExists) {
        const stats = fs.statSync(video.filePath);
        console.log('File size:', Math.round(stats.size / 1024 / 1024 * 100) / 100, 'MB');
      }
      
      console.log('\n🔗 Video should now be accessible at:');
      console.log(`https://video-management-system.vercel.app/video/${videoId}`);
    } else {
      console.log('❌ Video not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixVideo();