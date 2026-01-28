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
      const newSocket = io(process.env.NODE_ENV === 'production' 
        ? window.location.origin 
        : 'http://localhost:5000'
      );

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setConnected(true);
        
        // Join user-specific room
        newSocket.emit('join-room', user._id);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setConnected(false);
      });

      // Listen for video processing progress
      newSocket.on('video-progress', (data) => {
        console.log('Video progress update:', data);
        
        setVideoProgress(prev => ({
          ...prev,
          [data.videoId]: data
        }));

        // Show toast notifications for important updates
        if (data.status === 'completed') {
          toast.success(`Video "${data.video?.title || 'Unknown'}" processing completed!`);
        } else if (data.status === 'failed') {
          toast.error(`Video processing failed: ${data.message}`);
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