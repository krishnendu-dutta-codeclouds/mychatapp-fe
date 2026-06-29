import React, { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const socketUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { accessToken, apiBase, loading } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  // Wait for both `accessToken` and a resolved `apiBase` to be available
  // so the Socket.IO gateway targets the backend we just selected
  // (local if reachable, otherwise online).
  useEffect(() => {
    if (loading || !apiBase || !accessToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        connected && setConnected(false);
      }
      return;
    }

    // Connect to Socket.IO using dynamically resolved absolute URL
    const newSocket = io(apiBase, {
      auth: {
        token: accessToken
      },
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO Gateway Connected.');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO Gateway Disconnected.');
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [accessToken, loading, apiBase]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
