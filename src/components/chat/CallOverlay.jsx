import React from 'react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Shield } from 'lucide-react';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function CallOverlay() {
  const { getAvatarUrl } = useAuth();
  const {
    callState,
    isMuted,
    callDuration,
    callerDetails,
    calleeDetails,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute
  } = useCall();

  if (callState === 'idle') return null;

  // Resolve details of the peer we are communicating with
  const isIncoming = callState === 'ringing';
  const peer = isIncoming ? callerDetails : calleeDetails;

  if (!peer) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none font-sans">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden p-6 flex flex-col items-center justify-between min-h-[460px] relative text-center"
        >
          {/* Top Security Banner */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-4">
            <Shield className="h-3 w-3" /> Encrypted Call
          </div>

          {/* Peer Avatar & Ripples */}
          <div className="relative my-6 flex items-center justify-center h-32 w-32">
            {/* Pulsing Ripple Rings */}
            {(callState === 'dialing' || callState === 'ringing') && (
              <>
                <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute -inset-4 rounded-full border border-emerald-500/10 animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }} />
              </>
            )}
            {callState === 'connected' && (
              <div className="absolute -inset-2 rounded-full border border-emerald-500/20 animate-pulse" />
            )}

            {peer.avatarUrl ? (
              <img
                src={getAvatarUrl(peer.avatarUrl)}
                alt={peer.name}
                className="h-28 w-28 rounded-full object-cover border-4 border-zinc-800 shadow-2xl relative z-10"
              />
            ) : (
              <div className="h-28 w-28 rounded-full bg-gradient-to-tr from-emerald-500/20 to-emerald-500/5 border-4 border-zinc-800 flex items-center justify-center text-emerald-400 font-bold text-3xl uppercase shadow-2xl relative z-10">
                {getInitials(peer.name)}
              </div>
            )}
          </div>

          {/* Name & Call State Metadata */}
          <div className="space-y-2 flex-1">
            <h3 className="text-lg font-bold text-white leading-snug">{peer.name}</h3>
            
            <div className="flex flex-col items-center gap-1">
              {callState === 'dialing' && (
                <span className="text-xs text-emerald-400 font-semibold tracking-wider animate-pulse uppercase">
                  Calling...
                </span>
              )}
              {callState === 'ringing' && (
                <span className="text-xs text-emerald-400 font-semibold tracking-wider animate-pulse uppercase">
                  Incoming Voice Call
                </span>
              )}
              {callState === 'connected' && (
                <div className="flex flex-col items-center gap-3">
                  <span className="text-sm font-mono font-bold text-zinc-300 tracking-wider">
                    {formatDuration(callDuration)}
                  </span>
                  
                  {/* Premium animated voice visualizer lines */}
                  <div className="flex items-end justify-center gap-1.5 h-6 mt-1">
                    {[0.6, 0.9, 0.4, 0.8, 0.5, 0.9, 0.3].map((delay, idx) => (
                      <motion.span
                        key={idx}
                        animate={{ height: ['4px', '20px', '4px'] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          delay: delay * 0.8,
                          ease: 'easeInOut'
                        }}
                        className="w-1 rounded-full bg-emerald-500/60"
                      />
                    ))}
                  </div>
                </div>
              )}
              {callState === 'ended' && (
                <span className="text-xs text-rose-500 font-bold tracking-wider uppercase">
                  Call Ended
                </span>
              )}
            </div>
          </div>

          {/* Call Controls & Action Buttons */}
          <div className="w-full mt-8 flex justify-center items-center gap-6 z-10">
            {isIncoming ? (
              // Callee Controls: Reject or Accept
              <>
                <button
                  onClick={rejectCall}
                  className="p-4 bg-rose-500 hover:bg-rose-400 text-white rounded-full shadow-lg shadow-rose-500/20 active:scale-95 transition-all duration-150 border border-rose-600/30 flex items-center justify-center"
                  title="Decline Call"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
                
                <button
                  onClick={acceptCall}
                  className="p-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-full shadow-lg shadow-emerald-500/30 active:scale-95 transition-all duration-150 border border-emerald-600/30 animate-bounce flex items-center justify-center"
                  style={{ animationDuration: '2s' }}
                  title="Answer Call"
                >
                  <Phone className="h-6 w-6" />
                </button>
              </>
            ) : (
              // Caller/Connected Active call controls: Mute, Hang Up
              <>
                {callState === 'connected' && (
                  <button
                    onClick={toggleMute}
                    className={`p-3.5 rounded-full border transition-all duration-150 flex items-center justify-center ${
                      isMuted
                        ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/35'
                        : 'bg-zinc-800 border-zinc-700/80 text-zinc-300 hover:bg-zinc-750 hover:text-white'
                    }`}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </button>
                )}

                <button
                  onClick={endCall}
                  disabled={callState === 'ended'}
                  className="p-4 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-full shadow-lg shadow-rose-500/25 active:scale-95 transition-all duration-150 border border-rose-600/30 flex items-center justify-center"
                  title="End Call"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
