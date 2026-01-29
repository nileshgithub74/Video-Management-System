import mongoose from 'mongoose';
import Video from './models/Video.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkVideo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const videoId = '697b3ab84d97acff1e694e11';
    console.log('Checking video ID:', videoId);

    const video = await Video.findById(videoId).populate('uploadedBy', 'username email role');
    
    if (video) {
      console.log('✅ Video found in database:');
      console.log('Title:', video.title);
      console.log('Status:', video.processingStatus);
      console.log('Sensitivity:', video.sensitivityStatus);
      console.log('Public:', video.isPublic);
      console.log('File Path:', video.filePath);
      console.log('Uploader:', video.uploadedBy?.username, '(' + video.uploadedBy?.role + ')');
      console.log('Created:', video.createdAt);
    } else {
      console.log('❌ Video not found in database');
      
      // List all videos to see what's available
      const allVideos = await Video.find({}).populate('uploadedBy', 'username').limit(5);
      console.log('\n📋 Available videos:');
      allVideos.forEach(v => {
        console.log(`- ${v._id}: ${v.title} (${v.processingStatus}) by ${v.uploadedBy?.username}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkVideo();