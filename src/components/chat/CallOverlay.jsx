import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Shield, Video, VideoOff, CameraOff } from 'lucide-react';

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
    isVideoCall,
    isCameraOff,
    callDuration,
    callerDetails,
    calleeDetails,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera
  } = useCall();

  // Local video element ref (for PiP preview)
  const localVidRef = useRef(null);
  const remoteVidRef = useRef(null);

  // PiP drag state
  const [pipPosition, setPipPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Controls visibility (auto-hide after 4s of inactivity when connected video call)
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef(null);

  // Directly bind streams to local video elements reactively
  useEffect(() => {
    if (localVidRef.current) {
      localVidRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVidRef.current) {
      remoteVidRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  // Auto-hide controls for connected video calls
  useEffect(() => {
    if (callState === 'connected' && isVideoCall) {
      resetControlsTimer();
    } else {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [callState, isVideoCall]);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  const handleOverlayInteraction = () => {
    if (callState === 'connected' && isVideoCall) {
      resetControlsTimer();
    }
  };

  // PiP drag handlers
  const handlePipMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - pipPosition.x,
      y: e.clientY - pipPosition.y
    };
  };

  const handlePipTouchStart = (e) => {
    e.stopPropagation();
    const touch = e.touches[0];
    setIsDragging(true);
    dragOffset.current = {
      x: touch.clientX - pipPosition.x,
      y: touch.clientY - pipPosition.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPipPosition({
        x: Math.max(8, Math.min(window.innerWidth - 168, clientX - dragOffset.current.x)),
        y: Math.max(8, Math.min(window.innerHeight - 228, clientY - dragOffset.current.y))
      });
    };

    const handleEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  if (callState === 'idle') return null;

  // Resolve details of the peer we are communicating with
  const isIncoming = callState === 'ringing';
  const peer = isIncoming ? callerDetails : calleeDetails;

  if (!peer) return null;

  const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled;
  const hasLocalVideo = localStream && localStream.getVideoTracks().length > 0 && localStream.getVideoTracks()[0].enabled;

  // ─── AUDIO-ONLY CALL OVERLAY (original card-style) ───
  if (!isVideoCall) {
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

  // ─── VIDEO CALL OVERLAY (WhatsApp-style fullscreen) ───
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black select-none font-sans"
        onClick={handleOverlayInteraction}
        onMouseMove={handleOverlayInteraction}
      >
        {/* Fullscreen Video Background */}
        {isVideoCall && callState !== 'connected' ? (
          <video
            ref={localVidRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover mirror-video"
          />
        ) : (
          <video
            ref={remoteVidRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Fallback overlay (shows avatar/metadata when dialing/ringing, or if remote video isn't ready) */}
        {(callState !== 'connected' || !hasRemoteVideo) && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 ${
            isVideoCall
              ? 'bg-black/35 backdrop-blur-[1px]'
              : 'bg-gradient-to-b from-zinc-900 via-zinc-950 to-black'
          }`}>
            {/* Peer Avatar */}
            <div className="relative flex items-center justify-center h-36 w-36 mb-6">
              {(callState === 'dialing' || callState === 'ringing') && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" style={{ animationDuration: '3s' }} />
                  <div className="absolute -inset-6 rounded-full border border-emerald-500/10 animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }} />
                </>
              )}
              {peer.avatarUrl ? (
                <img
                  src={getAvatarUrl(peer.avatarUrl)}
                  alt={peer.name}
                  className="h-32 w-32 rounded-full object-cover border-4 border-zinc-800 shadow-2xl relative z-10"
                />
              ) : (
                <div className="h-32 w-32 rounded-full bg-gradient-to-tr from-emerald-500/20 to-emerald-500/5 border-4 border-zinc-800 flex items-center justify-center text-emerald-400 font-bold text-4xl uppercase shadow-2xl relative z-10">
                  {getInitials(peer.name)}
                </div>
              )}
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">{peer.name}</h3>
            {callState === 'dialing' && (
              <span className="text-sm text-emerald-400 font-semibold tracking-wider animate-pulse uppercase">
                Calling...
              </span>
            )}
            {callState === 'ringing' && (
              <span className="text-sm text-emerald-400 font-semibold tracking-wider animate-pulse uppercase">
                Incoming Video Call
              </span>
            )}
            {callState === 'ended' && (
              <span className="text-sm text-rose-500 font-bold tracking-wider uppercase">
                Call Ended
              </span>
            )}
          </div>
        )}

        {/* Top gradient bar with call info */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 pt-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Encrypted badge */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <Shield className="h-3 w-3 text-emerald-400" />
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Encrypted</span>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-sm font-semibold text-white">{peer.name}</span>
                  {callState === 'connected' && (
                    <span className="text-xs font-mono text-zinc-300 tracking-wider">
                      {formatDuration(callDuration)}
                    </span>
                  )}
                  {callState === 'dialing' && (
                    <span className="text-xs text-emerald-400 animate-pulse">Calling...</span>
                  )}
                  {callState === 'ringing' && (
                    <span className="text-xs text-emerald-400 animate-pulse">Incoming Video Call</span>
                  )}
                </div>

                <div className="w-16" /> {/* Spacer for balance */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Local Video PiP (draggable corner preview) */}
        {callState === 'connected' && (
          <div
            className="absolute z-40 rounded-2xl overflow-hidden shadow-2xl border-2 border-zinc-800/80 cursor-grab active:cursor-grabbing"
            style={{
              width: 160,
              height: 220,
              left: pipPosition.x,
              top: pipPosition.y,
              touchAction: 'none'
            }}
            onMouseDown={handlePipMouseDown}
            onTouchStart={handlePipTouchStart}
          >
            {isCameraOff || !hasLocalVideo ? (
              <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center gap-2">
                <CameraOff className="h-8 w-8 text-zinc-600" />
                <span className="text-[10px] text-zinc-500 font-medium">Camera Off</span>
              </div>
            ) : (
              <video
                ref={localVidRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror-video"
              />
            )}
          </div>
        )}

        {/* Bottom Controls Bar */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-10 pt-16"
            >
              <div className="flex justify-center items-center gap-5">
                {isIncoming ? (
                  // Incoming call: reject + accept
                  <>
                    <button
                      onClick={rejectCall}
                      className="p-4 bg-rose-500 hover:bg-rose-400 text-white rounded-full shadow-lg shadow-rose-500/30 active:scale-90 transition-all duration-150"
                      title="Decline"
                    >
                      <PhoneOff className="h-7 w-7" />
                    </button>

                    <button
                      onClick={acceptCall}
                      className="p-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-full shadow-lg shadow-emerald-500/40 active:scale-90 transition-all duration-150 animate-bounce"
                      style={{ animationDuration: '2s' }}
                      title="Accept Video Call"
                    >
                      <Video className="h-7 w-7" />
                    </button>
                  </>
                ) : (
                  // Active / dialing: mute, camera, hangup
                  <>
                    {/* Mute */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                      className={`p-3.5 rounded-full backdrop-blur-md transition-all duration-150 active:scale-90 ${
                        isMuted
                          ? 'bg-white/20 text-white'
                          : 'bg-zinc-800/60 text-zinc-300 hover:text-white'
                      }`}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </button>

                    {/* Camera Toggle */}
                    {callState === 'connected' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCamera(); }}
                        className={`p-3.5 rounded-full backdrop-blur-md transition-all duration-150 active:scale-90 ${
                          isCameraOff
                            ? 'bg-white/20 text-white'
                            : 'bg-zinc-800/60 text-zinc-300 hover:text-white'
                        }`}
                        title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                      >
                        {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                      </button>
                    )}

                    {/* End Call */}
                    <button
                      onClick={(e) => { e.stopPropagation(); endCall(); }}
                      disabled={callState === 'ended'}
                      className="p-4 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-full shadow-lg shadow-rose-500/30 active:scale-90 transition-all duration-150"
                      title="End Call"
                    >
                      <PhoneOff className="h-7 w-7" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
