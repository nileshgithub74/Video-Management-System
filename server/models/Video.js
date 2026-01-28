import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    default: 0
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'rejected'],
    default: 'pending'
  },
  processingProgress: {
    type: Number,
    default: 0
  },
  rejectionReason: {
    type: String
  },
  sensitivityStatus: {
    type: String,
    enum: ['unknown', 'safe', 'flagged'],
    default: 'unknown'
  },
  sensitivityScore: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String
  }],
  category: {
    type: String,
    default: 'general'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  metadata: {
    width: Number,
    height: Number,
    bitrate: Number,
    codec: String,
    fps: Number
  }
}, {
  timestamps: true
});

videoSchema.index({ uploadedBy: 1 });
videoSchema.index({ processingStatus: 1 });
videoSchema.index({ sensitivityStatus: 1 });
videoSchema.index({ createdAt: -1 });

export default mongoose.model('Video', videoSchema);