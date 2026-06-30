import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useChat } from './context/ChatContext';
import { useSocket } from './context/SocketContext';
import AuthScreen from './components/auth/AuthScreen';
import Sidebar from './components/sidebar/Sidebar';
import ChatWindow from './components/chat/ChatWindow';
import CallOverlay from './components/chat/CallOverlay';
import AdminDashboard from './components/admin/AdminDashboard';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';

function App() {
  const { user, loading: authLoading, isAdminPortalOpen, setIsAdminPortalOpen, getAvatarUrl, completeTokenLogin } = useAuth();
  const { activeChat } = useChat();
  const { socket, connected: socketConnected } = useSocket();
  const [broadcastAlert, setBroadcastAlert] = useState(null);

  useEffect(() => {
    if (!socket) return;
    
    const handleBroadcast = (data) => {
      setBroadcastAlert(data);
    };

    socket.on('system_broadcast', handleBroadcast);
    return () => {
      socket.off('system_broadcast', handleBroadcast);
    };
  }, [socket]);

  // Auto-dismiss broadcast after 12 seconds
  useEffect(() => {
    if (!broadcastAlert) return;
    const timer = setTimeout(() => {
      setBroadcastAlert(null);
    }, 12000);
    return () => clearTimeout(timer);
  }, [broadcastAlert]);

  // Dynamic height adjustment to handle mobile virtual keyboards
  useEffect(() => {
    const handleResize = () => {
      const height = window.visualViewport 
        ? window.visualViewport.height 
        : window.innerHeight;
      document.documentElement.style.setProperty('--viewport-height', `${height}px`);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    window.addEventListener('resize', handleResize);
    
    handleResize();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle Capacitor Deep Links (Android redirect tokens)
  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const handleDeepLink = (event) => {
        console.log('🔗 Received deep link intent URL:', event.url);
        try {
          const parsedUrl = new URL(event.url);
          if (parsedUrl.host === 'auth-success') {
            const accessToken = parsedUrl.searchParams.get('accessToken');
            const refreshToken = parsedUrl.searchParams.get('refreshToken');
            if (accessToken && refreshToken) {
              console.log('🔑 Extracted tokens from deep link. Authenticating...');
              completeTokenLogin(accessToken, refreshToken);
            }
          }
        } catch (err) {
          console.error('Failed to parse deep link URL:', err);
        }
      };

      CapApp.addListener('appUrlOpen', handleDeepLink);

      // Check for launcher intent URL on cold start
      CapApp.getLaunchUrl().then((launchUrl) => {
        if (launchUrl && launchUrl.url) {
          handleDeepLink(launchUrl);
        }
      });

      return () => {
        CapApp.removeAllListeners();
      };
    }
  }, [completeTokenLogin]);

  const isAppLoading = authLoading || (user && !socketConnected);

  if (isAppLoading) {
    return (
      <div
        className="w-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center"
        style={{ height: 'var(--viewport-height, 100dvh)' }}
      >
        {/* Beautiful animated glassmorphic loading spinner */}
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          <div className="absolute text-2xl">💬</div>
        </div>
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-zinc-400 font-medium tracking-wide text-sm loader-pulse"
        >
          Securing Connection...
        </motion.h1>
      </div>
    );
  }

  return (
    <div 
      className="w-screen bg-zinc-950 text-zinc-100 flex overflow-hidden select-none font-sans"
      style={{ height: 'var(--viewport-height, 100dvh)' }}
    >
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="h-full w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950"
            style={{ height: 'var(--viewport-height, 100dvh)' }}
          >
            <AuthScreen />
          </motion.div>
        ) : (
          <motion.div 
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="h-full w-full flex overflow-hidden"
          >
            {/* Left Sidebar Pane - Mobile/iPad Responsive Single-Pane Layout */}
            <div className={`h-full flex-shrink-0 border-r border-zinc-800/60 bg-zinc-900/45 backdrop-blur-md z-10 transition-all duration-300 ${activeChat ? 'hidden lg:flex lg:w-[380px] xl:w-[420px]' : 'flex w-full lg:w-[380px] xl:w-[420px]'}`}>
              <Sidebar />
            </div>
            
            {/* Right Chat Area Pane - Mobile/iPad Responsive Single-Pane Layout */}
            <div className={`h-full relative bg-zinc-950 transition-all duration-300 ${activeChat ? 'flex flex-1 w-full' : 'hidden lg:flex lg:flex-1'}`}>
              <ChatWindow />
            </div>

            {/* Fullscreen Admin Dashboard Portal Overlay */}
            <AnimatePresence>
              {isAdminPortalOpen && user?.role === 'admin' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="z-50"
                >
                  <AdminDashboard onClose={() => setIsAdminPortalOpen(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time System Broadcast Alert Overlay */}
      <AnimatePresence>
        {broadcastAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -50, scale: 0.95, x: '-50%' }}
            className="fixed top-4 left-1/2 z-[9999] w-[90%] max-w-md p-4 rounded-2xl bg-zinc-900/90 border border-white/10 backdrop-blur-xl shadow-2xl flex gap-3.5 items-start cursor-pointer select-text"
            onClick={() => setBroadcastAlert(null)}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${
              broadcastAlert.severity === 'danger' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              broadcastAlert.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  System Broadcast
                </span>
                <span className="text-[9px] text-zinc-500">
                  {new Date(broadcastAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs font-semibold text-white mt-1 leading-relaxed">
                {broadcastAlert.message}
              </p>
              {broadcastAlert.mediaUrl && (
                <div className="mt-2.5 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950/45 max-h-32 flex justify-center items-center">
                  <img src={getAvatarUrl(broadcastAlert.mediaUrl)} alt="Broadcast attachment" className="max-w-full max-h-32 object-contain" />
                </div>
              )}
            </div>
            <button className="text-zinc-500 hover:text-white p-0.5 rounded-lg hover:bg-zinc-800/50">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time WebRTC Audio Calling Portal Overlay */}
      <CallOverlay />
    </div>
  );
}

export default App;
