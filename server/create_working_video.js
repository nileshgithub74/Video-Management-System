import mongoose from 'mongoose';
import Video from './models/Video.js';
import User from './models/User.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function createWorkingVideo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('Created uploads directory');
    }

    // Create a simple test video file (this is just a placeholder - in real scenario you'd have an actual video file)
    const testVideoPath = path.join(uploadsDir, 'test-sample-video.mp4');
    
    // Create a minimal MP4 file header (this won't be a real playable video, but will exist as a file)
    const mp4Header = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ftyp box
      0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
      0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
      0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
    ]);
    
    fs.writeFileSync(testVideoPath, mp4Header);
    console.log('Created test video file:', testVideoPath);

    // Find an admin user
    const user = await User.findOne({ role: 'admin' });
    if (!user) {
      console.error('No admin user found');
      return;
    }

    // Update the existing video to point to our test file
    const videoId = '697b3ab84d97acff1e694e11';
    const updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      {
        filePath: testVideoPath,
        fileSize: mp4Header.length,
        isPublic: true,
        processingStatus: 'completed',
        sensitivityStatus: 'safe',
        sensitivityScore: 0,
        processingProgress: 100,
        duration: 10, // 10 seconds
        metadata: {
          width: 640,
          height: 480,
          quality: 'SD',
          fps: 30,
          format: 'mp4',
          bitrate: 1000000,
          codec: 'h264'
        }
      },
      { new: true }
    );

    if (updatedVideo) {
      console.log('✅ Video updated with working file path:');
      console.log('Title:', updatedVideo.title);
      console.log('File Path:', updatedVideo.filePath);
      console.log('File exists:', fs.existsSync(updatedVideo.filePath));
      console.log('Public:', updatedVideo.isPublic);
      console.log('Status:', updatedVideo.processingStatus);
      
      console.log('\n🔗 Video should now work at:');
      console.log(`https://video-management-system.vercel.app/video/${videoId}`);
      console.log('\n⚠️  Note: This is a test file, not a real video. For real videos, upload through the UI.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createWorkingVideo();