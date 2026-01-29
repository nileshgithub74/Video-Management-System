import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Calendar,
  User,
  Tag,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD 
  ? 'https://video-management-system-jdkv.onrender.com' 
  : 'http://localhost:5000');

const VideoPlayer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const videoRef = useRef(null);
  
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    fetchVideo();
  }, [id]);

  const fetchVideo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/videos/${id}`);
      setVideo(response.data.video);
      
      if (response.data.video.processingStatus !== 'completed') {
        setError('Video is still processing. Please try again later.');
      }
    } catch (error) {
      console.error('Failed to fetch video:', error);
      setError(error.response?.data?.message || 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = pos * duration;
    
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Video</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => navigate('/videos')}
          className="btn btn-primary"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/videos')}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back to Library
      </button>

      {/* Video Player */}
      <div className="bg-black rounded-lg overflow-hidden">
        <div className="relative group">
          <video
            ref={videoRef}
            className="w-full aspect-video"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            poster={`${API_URL}/api/placeholder-video-thumbnail.jpg`}
          >
            <source 
              src={`${API_URL}/api/videos/${id}/stream`} 
              type={video.mimeType}
            />
            Your browser does not support the video tag.
          </video>

          {/* Video Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Progress Bar */}
            <div 
              className="w-full h-2 bg-gray-600 rounded-full mb-4 cursor-pointer"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-primary-600 rounded-full"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              ></div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-primary-400 transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6" />
                  )}
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-primary-400 transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-primary-400 transition-colors"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Information */}
      <div className={`grid grid-cols-1 ${user?.role !== 'viewer' ? 'lg:grid-cols-3' : ''} gap-6`}>
        {/* Main Info */}
        <div className={`${user?.role !== 'viewer' ? 'lg:col-span-2' : ''} space-y-6`}>
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {video.title}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    {video.uploadedBy?.username}
                  </span>
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(video.createdAt).toLocaleDateString()}
                  </span>
                  <span>{video.viewCount} views</span>
                </div>
              </div>
              
              {/* Content Safety Badge */}
              <div className="flex items-center space-x-2">
                {video.sensitivityStatus === 'safe' ? (
                  <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">Safe Content</span>
                  </div>
                ) : video.sensitivityStatus === 'flagged' ? (
                  <div className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">Flagged Content</span>
                  </div>
                ) : (
                  <div className="flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full">
                    <span className="text-sm font-medium">Analyzing...</span>
                  </div>
                )}
              </div>
            </div>

            {video.description && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{video.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Only show for non-viewers */}
        {user?.role !== 'viewer' && (
          <div className="space-y-6">
            {/* Video Details */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Video Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{formatTime(video.duration || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">File Size:</span>
                  <span className="font-medium">{formatFileSize(video.fileSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Category:</span>
                  <span className="font-medium capitalize">{video.category || 'general'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Format:</span>
                  <span className="font-medium">{video.mimeType || 'Unknown'}</span>
                </div>
                {video.metadata && (
                  <>
                    {(video.metadata.width && video.metadata.height) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Resolution:</span>
                        <span className="font-medium">
                          {video.metadata.width} × {video.metadata.height}
                        </span>
                      </div>
                    )}
                    {video.metadata.fps && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Frame Rate:</span>
                        <span className="font-medium">{Math.round(video.metadata.fps)} fps</span>
                      </div>
                    )}
                    {video.metadata.quality && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Quality:</span>
                        <span className="font-medium">{video.metadata.quality}</span>
                      </div>
                    )}
                  </>
                )}
                {(video.sensitivityScore !== undefined && video.sensitivityScore !== null) && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Safety Score:</span>
                    <span className="font-medium">{video.sensitivityScore}/100</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {video.tags && video.tags.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {video.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded-full"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;