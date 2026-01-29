import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [videoProgress, setVideoProgress] = useState({});
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Initialize socket connection
      const newSocket = io(import.meta.env.VITE_API_URL || (process.env.NODE_ENV === 'production' 
        ? 'https://video-management-system-jdkv.onrender.com'
        : 'http://localhost:5000')
      );

      newSocket.on('connect', () => {

        setConnected(true);
        
        // Join user-specific room
        newSocket.emit('join-room', user._id);
      });

      newSocket.on('disconnect', () => {

        setConnected(false);
      });

      // Listen for video processing progress
      newSocket.on('videoProgress', (data) => {
        setVideoProgress(prev => ({
          ...prev,
          [data.videoId]: data
        }));
      });

      // Listen for video processing completion
      newSocket.on('videoProcessed', (data) => {
        setVideoProgress(prev => ({
          ...prev,
          [data.videoId]: data
        }));

        // Show toast notifications for important updates
        if (data.status === 'completed') {
          toast.success(`Video processing completed! Status: ${data.analysis?.status || 'Unknown'}`);
        } else if (data.status === 'failed') {
          toast.error(`Video processing failed: ${data.error || 'Unknown error'}`);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        toast.error('Real-time connection failed');
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setSocket(null);
        setConnected(false);
      };
    }
  }, [isAuthenticated, user]);

  const getVideoProgress = (videoId) => {
    return videoProgress[videoId] || null;
  };

  const clearVideoProgress = (videoId) => {
    setVideoProgress(prev => {
      const updated = { ...prev };
      delete updated[videoId];
      return updated;
    });
  };

  const value = {
    socket,
    connected,
    videoProgress,
    getVideoProgress,
    clearVideoProgress
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};