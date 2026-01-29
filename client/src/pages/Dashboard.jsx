import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { 
  Video, 
  Upload, 
  Users, 
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD 
  ? 'https://video-management-system-jdkv.onrender.com' 
  : 'http://localhost:5000');

const Dashboard = () => {
  const { user, isAdmin, isEditor } = useAuth();
  const { videoProgress } = useSocket();
  const [stats, setStats] = useState({
    totalVideos: 0,
    processingVideos: 0,
    completedVideos: 0,
    flaggedVideos: 0
  });
  const [recentVideos, setRecentVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [videosResponse] = await Promise.all([
        axios.get(`${API_URL}/api/videos?limit=5`)
      ]);

      const videos = videosResponse.data.videos;
      setRecentVideos(videos);

      // Calculate stats
      const totalVideos = videosResponse.data.pagination.total;
      const processingVideos = videos.filter(v => v.processingStatus === 'processing').length;
      const completedVideos = videos.filter(v => v.processingStatus === 'completed').length;
      const flaggedVideos = videos.filter(v => v.sensitivityStatus === 'flagged').length;

      setStats({
        totalVideos,
        processingVideos,
        completedVideos,
        flaggedVideos
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
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
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Unknown</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="section-spacing">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">VMS Dashboard</h1>
        <p className="page-subtitle">
          Welcome to your Video Management System dashboard, {user?.username}!
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Video className="w-8 h-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Videos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalVideos}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Activity className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Processing</p>
              <p className="text-2xl font-bold text-gray-900">{stats.processingVideos}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedVideos}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Flagged</p>
              <p className="text-2xl font-bold text-gray-900">{stats.flaggedVideos}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isEditor && (
            <Link
              to="/upload"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all duration-200"
            >
              <Upload className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Upload Video</p>
                <p className="text-sm text-gray-500">Add new video content</p>
              </div>
            </Link>
          )}
          
          <Link
            to="/videos"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all duration-200"
          >
            <Video className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Browse Videos</p>
              <p className="text-sm text-gray-500">View video library</p>
            </div>
          </Link>

          {isAdmin && (
            <Link
              to="/users"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all duration-200"
            >
              <Users className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Manage Users</p>
                <p className="text-sm text-gray-500">User administration</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Recent Videos */}
      <div className="card">
        <div className="flex-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Videos</h2>
          <Link
            to="/videos"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all
          </Link>
        </div>

        {recentVideos.length === 0 ? (
          <div className="text-center py-12">
            <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No videos uploaded yet</h3>
            <p className="text-gray-600 mb-4">
              Get started by uploading your first video to the system.
            </p>
            {isEditor && (
              <Link
                to="/upload"
                className="btn btn-primary"
              >
                Upload your first video
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {recentVideos.map((video) => {
              const progress = videoProgress[video._id];
              
              return (
                <div key={video._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    {getStatusIcon(progress?.status || video.processingStatus)}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-truncate">{video.title}</h3>
                      <p className="text-sm text-gray-500">
                        Uploaded {new Date(video.createdAt).toLocaleDateString()}
                      </p>
                      {progress && (
                        <div className="mt-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">{progress.progress}%</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{progress.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    {getSensitivityBadge(video.sensitivityStatus)}
                    {video.processingStatus === 'completed' && (
                      <Link
                        to={`/video/${video._id}`}
                        className="btn btn-primary text-sm px-3 py-1"
                      >
                        Watch
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;