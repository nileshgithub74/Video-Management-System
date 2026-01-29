import fs from 'fs';
import Video from '../models/Video.js';
import { processVideo } from '../services/videoProcessor.js';

export const uploadVideoController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No video file provided' });
    }

    const { title, description, tags, category, isPublic } = req.body;
    const { filename, originalname, path, size, mimetype } = req.file;
    const { _id: uploadedBy } = req.user;

    // Verify file exists after upload
    if (!fs.existsSync(path)) {
      console.error('Uploaded file not found at path:', path);
      return res.status(500).json({ msg: 'File upload failed - file not found after upload' });
    }

    const video = new Video({
      title,
      description,
      filename,
      originalName: originalname,
      filePath: path,
      fileSize: size,
      mimeType: mimetype,
      uploadedBy,
      tags: tags || [],
      category: category || 'general',
      isPublic: isPublic === 'true' || isPublic === true // Handle string/boolean conversion
    });

    const savedVideo = await video.save();

    // Start processing
    processVideo(savedVideo._id, req.io);

    res.status(201).json({ 
      msg: 'Video uploaded successfully', 
      video: savedVideo
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      msg: 'Upload failed', 
      error: error.message 
    });
  }
};

export const getAllVideosController = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, sensitivity, category, search } = req.query;
    const { role, _id: userId } = req.user;
    const skip = (page - 1) * limit;

    const filter = {};
    
    if (status) filter.processingStatus = status;
    if (sensitivity) filter.sensitivityStatus = sensitivity;
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Role-based filtering
    if (role === 'viewer') {
      filter.$or = [{ isPublic: true }, { uploadedBy: userId }];
      // Viewers can't see rejected or flagged videos
      filter.processingStatus = { $ne: 'rejected' };
      filter.sensitivityStatus = { $ne: 'flagged' };
    } else if (role === 'editor') {
      // Editors can see their own videos (including rejected/flagged ones) 
      // but only safe public videos
      filter.$or = [
        { uploadedBy: userId },
        { 
          isPublic: true, 
          processingStatus: { $ne: 'rejected' },
          sensitivityStatus: { $ne: 'flagged' }
        }
      ];
    }
    // Admins can see all videos including rejected and flagged ones

    const videos = await Video.find(filter)
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Video.countDocuments(filter);

    res.json({
      videos,
      pagination: { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch videos' });
  }
};

export const getVideoController = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, _id: userId } = req.user;
    const filter = { _id: id };
    
    if (role === 'viewer') {
      filter.$or = [{ isPublic: true }, { uploadedBy: userId }];
      // Viewers can't see rejected or flagged videos
      filter.processingStatus = { $ne: 'rejected' };
      filter.sensitivityStatus = { $ne: 'flagged' };
    } else if (role === 'editor') {
      // Editors can see their own videos (including rejected/flagged ones) 
      // but only safe public videos
      filter.$or = [
        { uploadedBy: userId },
        { 
          isPublic: true, 
          processingStatus: { $ne: 'rejected' },
          sensitivityStatus: { $ne: 'flagged' }
        }
      ];
    }

    const video = await Video.findOne(filter).populate('uploadedBy', 'username email');
    
    if (!video) {
      return res.status(404).json({ msg: 'Video not found' });
    }

    // Even if found (e.g. for editor who uploaded it), block details if flagged for others??
    // Actually, following the logic from getAllVideosController:
    // Editors can see their own flagged videos.
    // Viewers cannot see any flagged videos.
    // Admins can see everything.

    res.json({ video });
  } catch (error) {
    res.status(500).json({ msg: 'Failed to fetch video' });
  }
};

export const streamVideoController = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, _id: userId } = req.user;
    const { range } = req.headers;
    
    console.log(`🎬 Stream request for video ${id} by ${role} user ${userId}`);
    
    // Set CORS headers early
    res.set({
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Headers': 'Range, Content-Range, Content-Length, Content-Type'
    });
    
    // Find the video
    const video = await Video.findById(id);
    if (!video) {
      console.log(`❌ Video not found: ${id}`);
      return res.status(404).json({ msg: 'Video not found' });
    }

    console.log(`📹 Video found: ${video.title}, Status: ${video.processingStatus}, Safety: ${video.sensitivityStatus}`);

    // Check if video processing is complete
    if (video.processingStatus !== 'completed') {
      console.log(`⏳ Video still processing: ${video.processingStatus}`);
      return res.status(400).json({ msg: 'Video is still processing' });
    }

    // STRICT ACCESS CONTROL FOR FLAGGED VIDEOS
    if (video.sensitivityStatus === 'flagged') {
      if (role === 'admin') {
        console.log(`🔓 Admin access granted to flagged video`);
        // Admins can watch flagged videos
      } else if (role === 'editor' && video.uploadedBy.toString() === userId.toString()) {
        console.log(`🔓 Editor access granted to own flagged video`);
        // Editors can watch their own flagged videos
      } else {
        console.log(`🚫 Access denied to flagged video for ${role}`);
        return res.status(403).json({ 
          msg: 'This video has been flagged as inappropriate and cannot be watched',
          reason: 'Content flagged by AI safety system'
        });
      }
    }

    // Check public/private access
    if (!video.isPublic && video.uploadedBy.toString() !== userId.toString() && role !== 'admin') {
      console.log(`🔒 Access denied to private video`);
      return res.status(403).json({ msg: 'This video is private' });
    }

    // Check if file exists
    if (!fs.existsSync(video.filePath)) {
      console.error(`📁 Video file not found: ${video.filePath}`);
      return res.status(404).json({ msg: 'Video file not found on server' });
    }

    const stat = fs.statSync(video.filePath);
    const fileSize = stat.size;
    
    console.log(`📊 Streaming video: ${fileSize} bytes`);

    // Handle range requests for video seeking
    if (range) {
      const [start, end] = range.replace(/bytes=/, "").split("-");
      const startByte = parseInt(start, 10);
      const endByte = end ? parseInt(end, 10) : fileSize - 1;
      const chunksize = (endByte - startByte) + 1;
      
      console.log(`📡 Range request: ${startByte}-${endByte}/${fileSize}`);
      
      const file = fs.createReadStream(video.filePath, { start: startByte, end: endByte });
      
      res.status(206).set({
        'Content-Range': `bytes ${startByte}-${endByte}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': video.mimeType || 'video/mp4'
      });
      
      file.pipe(res);
    } else {
      // Full file streaming
      res.status(200).set({
        'Content-Length': fileSize,
        'Content-Type': video.mimeType || 'video/mp4',
        'Accept-Ranges': 'bytes'
      });
      
      fs.createReadStream(video.filePath).pipe(res);
    }

    // Update view count asynchronously (only for successful streams)
    Video.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }).catch(err => 
      console.error('Failed to update view count:', err)
    );
    
    console.log(`✅ Video stream started successfully`);
    
  } catch (error) {
    console.error('❌ Streaming error:', error);
    res.status(500).json({ msg: 'Streaming failed', error: error.message });
  }
};

export const updateVideoController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, tags, category, isPublic } = req.body;
    const { role, _id: userId } = req.user;
    const filter = { _id: id };
    
    if (role === 'editor') {
      filter.uploadedBy = userId;
    }

    const video = await Video.findOneAndUpdate(
      filter,
      { $set: { title, description, tags, category, isPublic } },
      { new: true }
    ).populate('uploadedBy', 'username email');

    if (!video) {
      return res.status(404).json({ msg: 'Video not found or access denied' });
    }

    res.json({ msg: 'Video updated successfully', video });
  } catch (error) {
    res.status(500).json({ msg: 'Update failed' });
  }
};

export const deleteVideoController = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, _id: userId } = req.user;
    const filter = { _id: id };
    
    // Only editors can delete their own videos
    if (role === 'editor') {
      filter.uploadedBy = userId;
    } else {
      return res.status(403).json({ msg: 'Only editors can delete their own videos' });
    }

    const video = await Video.findOne(filter);

    if (!video) {
      return res.status(404).json({ msg: 'Video not found or access denied' });
    }

    if (fs.existsSync(video.filePath)) {
      fs.unlinkSync(video.filePath);
    }

    await Video.findByIdAndDelete(id);
    res.json({ msg: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ msg: 'Delete failed' });
  }
};

export const rejectVideoController = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    const { reason } = req.body;
    
    // Only admins can reject videos
    if (role !== 'admin') {
      return res.status(403).json({ msg: 'Only admins can reject videos' });
    }

    const video = await Video.findByIdAndUpdate(
      id,
      { 
        processingStatus: 'rejected',
        rejectionReason: reason || 'Content policy violation'
      },
      { new: true }
    ).populate('uploadedBy', 'username email');

    if (!video) {
      return res.status(404).json({ msg: 'Video not found' });
    }

    res.json({ msg: 'Video rejected successfully', video });
  } catch (error) {
    res.status(500).json({ msg: 'Rejection failed' });
  }
};

// Manual override endpoint for admins to mark videos as safe
export const overrideVideoSafetyController = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    // Only admins can override safety status
    if (role !== 'admin') {
      return res.status(403).json({ msg: 'Only admins can override video safety status' });
    }

    const video = await Video.findByIdAndUpdate(
      id,
      { 
        sensitivityStatus: 'safe',
        sensitivityScore: 0
      },
      { new: true }
    ).populate('uploadedBy', 'username email');

    if (!video) {
      return res.status(404).json({ msg: 'Video not found' });
    }

    res.json({ msg: 'Video marked as safe successfully', video });
  } catch (error) {
    res.status(500).json({ msg: 'Override failed' });
  }
};
