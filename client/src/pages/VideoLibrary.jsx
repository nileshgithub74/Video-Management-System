import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  Filter, 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle,
  Eye,
  Calendar,
  FileVideo,
  Trash2,
  Ban
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD 
  ? 'https://video-management-system-jdkv.onrender.com' 
  : 'http://localhost:5000');

const VideoLibrary = () => {
  const { videoProgress } = useSocket();
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    sensitivity: '',
    category: '',
    page: 1
  });

  useEffect(() => {
    fetchVideos();
  }, [filters]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await axios.get(`${API_URL}/api/videos?${params}`);
      console.log('Fetched videos:', response.data.videos);
      console.log('Current user:', user);
      setVideos(response.data.videos);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset to page 1 when changing filters
    }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchVideos();
  };

  const getStatusIcon = (video) => {
    const progress = videoProgress[video._id];
    const status = progress?.status || video.processingStatus;
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'rejected':
        return <Ban className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSensitivityBadge = (status) => {
    switch (status) {
      case 'safe':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Safe</span>;
      case 'flagged':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Flagged</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Analyzing</span>;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/videos/${videoId}`);
      // Remove video from local state
      setVideos(prev => prev.filter(video => video._id !== videoId));
      alert('Video deleted successfully');
    } catch (error) {
      console.error('Failed to delete video:', error);
      alert('Failed to delete video: ' + (error.response?.data?.msg || error.message));
    }
  };

  const handleRejectVideo = async (videoId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await axios.put(`${API_URL}/api/videos/${videoId}/reject`, { reason });
      // Update video status in local state
      setVideos(prev => prev.map(video => 
        video._id === videoId 
          ? { ...video, processingStatus: 'rejected', rejectionReason: reason }
          : video
      ));
      alert('Video rejected successfully');
    } catch (error) {
      console.error('Failed to reject video:', error);
      alert('Failed to reject video: ' + (error.response?.data?.msg || error.message));
    }
  };

  const canDeleteVideo = (video) => {
    return user?.role === 'editor' && video.uploadedBy?._id === user._id;
  };

  const canRejectVideo = (video) => {
    const isAdmin = user?.role === 'admin';
    const isNotRejected = video.processingStatus !== 'rejected';
    
    console.log('canRejectVideo check:', {
      videoId: video._id,
      videoTitle: video.title,
      userRole: user?.role,
      isAdmin,
      videoStatus: video.processingStatus,
      isNotRejected,
      canReject: isAdmin && isNotRejected
    });
    
    return isAdmin && isNotRejected;
  };

  return (
    <div className="section-spacing">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Video Library</h1>
        <p className="page-subtitle">
          Browse and manage your video collection.
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="space-y-6">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search videos..."
                  className="input pl-10"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary whitespace-nowrap">
              Search
            </button>
          </form>

          {/* Filter Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Processing Status
              </label>
              <select
                className="input"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Safety
              </label>
              <select
                className="input"
                value={filters.sensitivity}
                onChange={(e) => handleFilterChange('sensitivity', e.target.value)}
              >
                <option value="">All Content</option>
                <option value="safe">Safe</option>
                <option value="flagged">Flagged</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                className="input"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="general">General</option>
                <option value="education">Education</option>
                <option value="entertainment">Entertainment</option>
                <option value="business">Business</option>
                <option value="training">Training</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilters({
                  search: '',
                  status: '',
                  sensitivity: '',
                  category: '',
                  page: 1
                })}
                className="btn btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : videos.length === 0 ? (
        <div className="card text-center py-12">
          <FileVideo className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No videos found</h3>
          <p className="text-gray-600 mb-4">
            {filters.search || filters.status || filters.sensitivity || filters.category
              ? 'Try adjusting your filters to see more results.'
              : 'Upload your first video to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid-responsive">
          {videos.map((video) => {
            const progress = videoProgress[video._id];
            const canPlay = video.processingStatus === 'completed';
            
            return (
              <div key={video._id} className="card hover:shadow-lg transition-all duration-200">
                {/* Video Thumbnail Placeholder */}
                <div className="aspect-video bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                  <FileVideo className="w-12 h-12 text-gray-400" />
                </div>

                {/* Video Info */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">
                      {video.title}
                    </h3>
                    {video.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {video.description}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar for Processing Videos */}
                  {progress && progress.status === 'processing' && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex-between mb-2">
                        <span className="text-xs font-medium text-gray-600">Processing...</span>
                        <span className="text-xs font-medium text-gray-600">{progress.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress.progress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{progress.message}</p>
                    </div>
                  )}

                  {/* Video Metadata */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatDuration(video.duration)}
                      </span>
                      <span className="flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {video.viewCount}
                      </span>
                    </div>
                    <span className="flex items-center text-xs">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(video.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex-between">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(video)}
                      {getSensitivityBadge(video.sensitivityStatus)}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {canPlay && (
                        <Link
                          to={`/video/${video._id}`}
                          className="btn btn-primary text-xs px-3 py-1"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Watch
                        </Link>
                      )}
                      
                      {/* Delete Button for Editors */}
                      {canDeleteVideo(video) && (
                        <button
                          onClick={() => handleDeleteVideo(video._id)}
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Delete Video"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      
                      {/* Reject Button for Admins */}
                      {canRejectVideo(video) && (
                        <button
                          onClick={() => handleRejectVideo(video._id)}
                          className="text-orange-600 hover:text-orange-700 p-1"
                          title="Reject Video"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="text-xs text-gray-500 space-y-1 pt-3 border-t border-gray-100">
                    <div className="flex justify-between">
                      <span>Size: {formatFileSize(video.fileSize)}</span>
                      <span className="capitalize">Category: {video.category}</span>
                    </div>
                    <div>
                      Uploaded by: {video.uploadedBy?.username || 'Unknown'}
                    </div>
                    {video.tags && video.tags.length > 0 && (
                      <div>
                        Tags: {video.tags.join(', ')}
                      </div>
                    )}
                    {video.processingStatus === 'rejected' && video.rejectionReason && (
                      <div className="text-red-600 font-medium bg-red-50 p-2 rounded mt-2">
                        Rejected: {video.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="card">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleFilterChange('page', pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn btn-secondary disabled:opacity-50 text-sm px-3 py-1"
              >
                Previous
              </button>
              
              <span className="flex items-center px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded">
                Page {pagination.page} of {pagination.pages}
              </span>
              
              <button
                onClick={() => handleFilterChange('page', pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="btn btn-secondary disabled:opacity-50 text-sm px-3 py-1"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoLibrary;