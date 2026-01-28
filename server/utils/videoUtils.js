import fs from 'fs';
import path from 'path';

/**
 * Utility functions for video processing
 * Pure functional approach without classes or complex structures
 */

/**
 * Check if video file exists and is accessible
 */
export const validateVideoFile = (filePath) => {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
};

/**
 * Get basic file information
 */
export const getFileInfo = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    const extension = path.extname(filePath).toLowerCase();
    
    return {
      size: stats.size,
      extension,
      created: stats.birthtime,
      modified: stats.mtime,
      isValid: true
    };
  } catch (error) {
    return {
      size: 0,
      extension: '',
      created: null,
      modified: null,
      isValid: false,
      error: error.message
    };
  }
};

/**
 * Generate estimated metadata based on file size and type
 */
export const estimateVideoMetadata = (fileInfo) => {
  const { size, extension } = fileInfo;
  
  // Base duration estimate (very rough)
  const estimatedDuration = Math.floor(60 + (size / 10000000));
  
  // Quality estimates based on file size
  if (size > 100000000) { // > 100MB
    return {
      duration: estimatedDuration,
      width: 1920,
      height: 1080,
      quality: 'Full HD',
      estimatedBitrate: 8000000
    };
  } else if (size > 50000000) { // > 50MB
    return {
      duration: estimatedDuration,
      width: 1280,
      height: 720,
      quality: 'HD',
      estimatedBitrate: 5000000
    };
  } else {
    return {
      duration: estimatedDuration,
      width: 854,
      height: 480,
      quality: 'SD',
      estimatedBitrate: 2000000
    };
  }
};

/**
 * Simple content safety simulation
 */
export const simulateContentAnalysis = () => {
  const score = Math.random() * 100;
  return {
    score: Math.round(score * 100) / 100,
    status: score > 70 ? 'flagged' : 'safe',
    confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
    analyzedAt: new Date()
  };
};

/**
 * Create processing steps for progress tracking
 */
export const createProcessingSteps = () => [
  { progress: 5, message: 'Initializing...' },
  { progress: 20, message: 'Validating file...' },
  { progress: 40, message: 'Extracting metadata...' },
  { progress: 70, message: 'Analyzing content...' },
  { progress: 90, message: 'Finalizing...' },
  { progress: 100, message: 'Complete!' }
];

/**
 * Delay function for simulating processing time
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Format file size for display
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format duration in seconds to readable format
 */
export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};