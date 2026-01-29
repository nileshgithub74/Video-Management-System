import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD 
  ? 'https://video-management-system-jdkv.onrender.com' 
  : 'http://localhost:5000');

const VideoDebug = () => {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [video, setVideo] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    if (id) {
      testVideoAccess();
    }
  }, [id]);

  const testVideoAccess = async () => {
    const results = {};
    
    try {
      // Test 1: Fetch video metadata
      console.log('Testing video metadata fetch...');
      const response = await axios.get(`${API_URL}/api/videos/${id}`);
      results.metadata = { success: true, data: response.data.video };
      setVideo(response.data.video);
      
      // Test 2: Test stream URL accessibility
      const streamUrl = `${API_URL}/api/videos/${id}/stream?token=${token}`;
      setStreamUrl(streamUrl);
      console.log('Stream URL:', streamUrl);
      
      // Test 3: Try to fetch stream headers
      try {
        const streamResponse = await fetch(streamUrl, { 
          method: 'HEAD',
          credentials: 'include'
        });
        results.stream = { 
          success: streamResponse.ok, 
          status: streamResponse.status,
          headers: Object.fromEntries(streamResponse.headers.entries())
        };
      } catch (streamError) {
        results.stream = { success: false, error: streamError.message };
      }
      
    } catch (error) {
      results.metadata = { success: false, error: error.message };
    }
    
    setTestResults(results);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Video Debug - ID: {id}</h1>
      
      {/* User Info */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">User Info:</h2>
        <p>Role: {user?.role}</p>
        <p>Token: {token ? `${token.substring(0, 20)}...` : 'No token'}</p>
      </div>

      {/* Test Results */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Test Results:</h2>
        <pre className="text-sm overflow-auto">
          {JSON.stringify(testResults, null, 2)}
        </pre>
      </div>

      {/* Video Metadata */}
      {video && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Video Metadata:</h2>
          <p>Title: {video.title}</p>
          <p>Status: {video.processingStatus}</p>
          <p>Sensitivity: {video.sensitivityStatus}</p>
          <p>File Path: {video.filePath}</p>
          <p>MIME Type: {video.mimeType}</p>
          <p>Public: {video.isPublic ? 'Yes' : 'No'}</p>
        </div>
      )}

      {/* Stream URL Test */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Stream URL:</h2>
        <p className="text-sm break-all">{streamUrl}</p>
        <button 
          onClick={() => window.open(streamUrl, '_blank')}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Stream URL in New Tab
        </button>
      </div>

      {/* Video Player Test */}
      {video && video.processingStatus === 'completed' && (
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">Video Player Test:</h2>
          <video 
            controls 
            className="w-full max-w-md"
            onError={(e) => console.error('Video error:', e)}
            onLoadStart={() => console.log('Load start')}
            onCanPlay={() => console.log('Can play')}
          >
            <source src={streamUrl} type={video.mimeType} />
          </video>
        </div>
      )}
    </div>
  );
};

export default VideoDebug;