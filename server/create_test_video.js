import mongoose from 'mongoose';
import Video from './models/Video.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function createTestVideo() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find a user to assign as uploader (preferably an admin or editor)
    const user = await User.findOne({ role: { $in: ['admin', 'editor'] } });
    if (!user) {
      console.error('No admin or editor user found. Please create a user first.');
      return;
    }

    console.log('Found user:', user.username, 'Role:', user.role);

    // Create a test video entry
    const testVideo = new Video({
      title: 'Test Video - Sample Content',
      description: 'This is a test video created manually for debugging purposes.',
      filename: 'test-video.mp4',
      originalName: 'test-video.mp4',
      filePath: 'uploads/test-video.mp4', // This should be a real file path
      fileSize: 1024000, // 1MB
      mimeType: 'video/mp4',
      uploadedBy: user._id,
      tags: ['test', 'debug'],
      category: 'general',
      isPublic: true, // Make it public so viewers can see it
      processingStatus: 'completed', // Mark as completed
      processingProgress: 100,
      sensitivityStatus: 'safe',
      sensitivityScore: 0,
      duration: 30, // 30 seconds
      metadata: {
        width: 1920,
        height: 1080,
        quality: 'Full HD',
        fps: 30,
        format: 'mp4',
        bitrate: 2000000,
        codec: 'h264'
      },
      viewCount: 0,
      processedAt: new Date()
    });

    const savedVideo = await testVideo.save();
    console.log('✅ Test video created successfully!');
    console.log('Video ID:', savedVideo._id);
    console.log('Title:', savedVideo.title);
    console.log('Status:', savedVideo.processingStatus);
    console.log('Public:', savedVideo.isPublic);
    console.log('Uploader:', user.username);

    console.log('\n🔗 You can now test this video at:');
    console.log(`https://video-management-system.vercel.app/video/${savedVideo._id}`);
    console.log(`Debug URL: https://video-management-system.vercel.app/debug/${savedVideo._id}`);

  } catch (error) {
    console.error('❌ Error creating test video:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createTestVideo();