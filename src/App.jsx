import React from 'react';
import { useAuth } from './context/AuthContext';
import { useChat } from './context/ChatContext';
import AuthScreen from './components/auth/AuthScreen';
import Sidebar from './components/sidebar/Sidebar';
import ChatWindow from './components/chat/ChatWindow';
import AdminDashboard from './components/admin/AdminDashboard';
import { AnimatePresence, motion } from 'framer-motion';

function App() {
  const { user, loading, isAdminPortalOpen, setIsAdminPortalOpen } = useAuth();
  const { activeChat } = useChat();

  if (loading) {
    return (
      <div className="h-[100dvh] w-screen bg-zinc-950 flex flex-col items-center justify-center">
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
    <div className="h-[100dvh] w-screen bg-zinc-950 text-zinc-100 flex overflow-hidden select-none font-sans">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div 
            key="auth"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full flex items-center justify-center bg-zinc-950"
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
    </div>
  );
}

export default App;
