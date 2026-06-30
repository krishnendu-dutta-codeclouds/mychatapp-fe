import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  Users, SwitchCamera, Maximize2, Volume2
} from 'lucide-react';
import { useGroupCall } from '../../context/GroupCallContext';
import { useAuth } from '../../context/AuthContext';

/* ─── Helpers ──────────────────────────────────────────────── */
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatDuration = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/* ─── Audio auto-play element for remote streams ───────────── */
function RemoteAudio({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline style={{ display: 'none' }} />;
}

/* ─── Speaking ring animation ──────────────────────────────── */
function SpeakingRing({ speaking }) {
  if (!speaking) return null;
  return (
    <motion.div
      className="absolute inset-0 rounded-2xl pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-emerald-400"
        animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.012, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
    </motion.div>
  );
}

/* ─── Avatar / gradient palette per participant ─────────────── */
const GRADIENTS = [
  'from-emerald-600 to-teal-700',
  'from-violet-600 to-indigo-700',
  'from-rose-600 to-pink-700',
  'from-amber-600 to-orange-700',
  'from-sky-600 to-blue-700',
  'from-fuchsia-600 to-purple-700',
];

/* ─── Large featured participant tile ─────────────────────── */
function FeaturedTile({ participant, stream, isLocal, isMuted, isCameraOff, isVideo, speaking, gradientIdx }) {
  const vidRef = useRef(null);
  const gradient = GRADIENTS[gradientIdx % GRADIENTS.length];

  useEffect(() => {
    if (vidRef.current) vidRef.current.srcObject = stream || null;
  }, [stream]);

  const showVideo = isVideo && stream && !(isLocal && isCameraOff);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-none bg-zinc-950">
      {showVideo ? (
        <video
          ref={vidRef}
          autoPlay playsInline muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={speaking ? { scale: [1, 1.04, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
            className={`h-24 w-24 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-4xl font-bold text-white shadow-2xl`}
          >
            {getInitials(participant?.name)}
          </motion.div>
          <p className="text-white/60 text-sm font-medium">{isLocal ? 'You (Camera off)' : (participant?.name || 'Unknown')}</p>
        </div>
      )}

      {/* Speaking ring overlay */}
      <AnimatePresence>
        {speaking && !showVideo && (
          <motion.div
            className="absolute inset-0 rounded-none pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-emerald-500/5" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Name + mute badge at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        {speaking && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
          >
            <Volume2 className="h-2.5 w-2.5 text-white" />
          </motion.div>
        )}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-md">
          {isMuted && isLocal && <MicOff className="h-3 w-3 text-red-400" />}
          <span className="text-white text-[13px] font-semibold">
            {participant?.name}{isLocal ? ' (You)' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Small thumbnail strip tile ───────────────────────────── */
function ThumbnailTile({ participant, stream, isLocal, isMuted: isLocalMuted, isCameraOff, isVideo, speaking, gradientIdx, isActive, onClick }) {
  const vidRef = useRef(null);
  const gradient = GRADIENTS[gradientIdx % GRADIENTS.length];

  useEffect(() => {
    if (vidRef.current) vidRef.current.srcObject = stream || null;
  }, [stream]);

  const showVideo = isVideo && stream && !(isLocal && isCameraOff);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onClick}
      className={`relative flex-shrink-0 w-24 h-36 rounded-2xl overflow-hidden cursor-pointer ${
        isActive ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-black' : ''
      }`}
      style={{ background: '#18181b' }}
    >
      {showVideo ? (
        <video ref={vidRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-sm font-bold text-white`}>
            {getInitials(participant?.name)}
          </div>
        </div>
      )}

      {/* Speaking indicator */}
      <AnimatePresence>
        {speaking && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-2xl border-2 border-emerald-400 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Bottom name */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1.5 pt-4">
        <div className="flex items-center gap-1">
          {isLocal && isLocalMuted && <MicOff className="h-2.5 w-2.5 text-red-400 flex-shrink-0" />}
          <span className="text-white text-[9px] font-semibold truncate">
            {isLocal ? 'You' : (participant?.name?.split(' ')[0] || 'User')}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN OVERLAY
═══════════════════════════════════════════════════════════════ */
export default function GroupCallOverlay() {
  const { user } = useAuth();
  const {
    groupCallState, groupCallRoom, participants,
    localStream, remoteStreams,
    isMuted, isCameraOff, isGroupVideoCall,
    callDuration, notifications,
    acceptGroupCall, declineGroupCall, leaveGroupCall,
    toggleGroupMute, toggleGroupCamera,
  } = useGroupCall();

  // Pinned / featured participant id (null = auto-pick from speaking)
  const [pinnedId, setPinnedId] = useState(null);
  // Speaking state: Map<participantId, boolean>
  const [speakingMap, setSpeakingMap] = useState(new Map());
  // Show/hide controls for a clean full-screen look
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef(null);
  // Analysers for audio detection
  const analysersRef = useRef(new Map()); // peerId -> AnalyserNode
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);

  /* ── auto-hide controls after 4s ─────────────────────────── */
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (groupCallState === 'connected') {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 4000);
    }
  }, [groupCallState]);

  useEffect(() => {
    resetControlsTimer();
    return () => clearTimeout(controlsTimerRef.current);
  }, [groupCallState, resetControlsTimer]);

  /* ── Audio speaking detection ─────────────────────────────── */
  const connectAnalyser = useCallback((peerId, stream) => {
    if (!stream || analysersRef.current.has(peerId)) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analysersRef.current.set(peerId, analyser);
    } catch (_) {}
  }, []);

  // Connect analyser whenever streams change
  useEffect(() => {
    if (localStream) connectAnalyser('local', localStream);
    remoteStreams.forEach((stream, peerId) => connectAnalyser(peerId, stream));
  }, [localStream, remoteStreams, connectAnalyser]);

  // Poll audio levels every 100ms via rAF
  useEffect(() => {
    if (groupCallState !== 'connected') return;

    const data = new Uint8Array(256);
    const tick = () => {
      setSpeakingMap(prev => {
        let changed = false;
        const next = new Map(prev);
        analysersRef.current.forEach((analyser, id) => {
          analyser.getByteFrequencyData(data);
          const avg = data.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
          const isSpeaking = avg > 18;
          if (next.get(id) !== isSpeaking) { next.set(id, isSpeaking); changed = true; }
        });
        return changed ? next : prev;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [groupCallState, analysersRef]);

  /* ── Determine featured participant ───────────────────────── */
  const allParticipants = [
    { id: user?.id, name: user?.displayName, isLocal: true },
    ...participants.filter(p => p.id !== user?.id).map(p => ({ ...p, isLocal: false }))
  ];

  const activeSpeakerId = (() => {
    // Find the loudest remote speaker (prefer remote over local for featured view)
    for (const [id, speaking] of speakingMap) {
      if (speaking && id !== 'local') return id;
    }
    return null;
  })();

  const featuredId = pinnedId || activeSpeakerId || (allParticipants[1]?.id || allParticipants[0]?.id);
  const featuredParticipant = allParticipants.find(p => p.id === featuredId) || allParticipants[0];

  const thumbnailParticipants = allParticipants.filter(p => p.id !== featuredParticipant?.id);

  /* ═══ IDLE ═══ */
  if (groupCallState === 'idle') return null;

  /* ═══ INCOMING RINGING ═══ */
  if (groupCallState === 'ringing') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center font-sans"
          style={{ background: 'linear-gradient(160deg, #0b1120 0%, #050c1a 60%, #0a0f1e 100%)' }}
        >
          {/* Background pulse rings */}
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-emerald-500/20"
              style={{ width: 120 + i * 90, height: 120 + i * 90 }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.05, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}

          <div className="relative flex flex-col items-center text-center px-8">
            {/* Group icon */}
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="h-24 w-24 rounded-3xl bg-gradient-to-br from-emerald-600/30 to-teal-700/20 border border-emerald-500/30 flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/10"
            >
              <Users className="h-11 w-11 text-emerald-400" />
            </motion.div>

            <p className="text-[11px] text-emerald-400 font-bold tracking-[0.2em] uppercase mb-2">
              Incoming Group {isGroupVideoCall ? 'Video' : 'Voice'} Call
            </p>
            <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">{groupCallRoom?.groupName}</h2>
            <p className="text-sm text-zinc-400 mb-12">
              <span className="text-zinc-200 font-medium">{groupCallRoom?.initiatorName}</span> started a call
            </p>

            <div className="flex items-end gap-8">
              {/* Decline */}
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                  onClick={declineGroupCall}
                  className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-2xl shadow-red-500/40 transition"
                >
                  <PhoneOff className="h-6 w-6 text-white" />
                </motion.button>
                <span className="text-xs text-zinc-400 font-medium">Decline</span>
              </div>

              {/* Accept */}
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                  onClick={acceptGroupCall}
                  className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-2xl shadow-emerald-500/40 transition"
                >
                  <motion.div
                    animate={{ rotate: [0, 12, -8, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1 }}
                  >
                    <Phone className="h-6 w-6 text-white" />
                  </motion.div>
                </motion.button>
                <span className="text-xs text-zinc-400 font-medium">Join</span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  /* ═══ CONNECTING ═══ */
  if (groupCallState === 'connecting') {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 font-sans"
        style={{ background: '#050c1a' }}
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-14 w-14 rounded-full border-2 border-emerald-500/30 border-t-emerald-500"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Users className="h-5 w-5 text-emerald-400" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-base">{groupCallRoom?.groupName}</p>
          <p className="text-zinc-400 text-sm mt-1">Connecting…</p>
        </div>
      </motion.div>
    );
  }

  /* ═══ CONNECTED — WhatsApp-style layout ═══ */
  const featuredStream = featuredParticipant?.isLocal
    ? localStream
    : remoteStreams.get(featuredParticipant?.id);
  const featuredSpeaking = featuredParticipant?.isLocal
    ? speakingMap.get('local')
    : speakingMap.get(featuredParticipant?.id);
  const featuredGradient = allParticipants.findIndex(p => p.id === featuredParticipant?.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={resetControlsTimer}
      className="fixed inset-0 z-[9998] flex flex-col select-none font-sans overflow-hidden"
      style={{ background: '#050c1a' }}
    >
      {/* ── Hidden audio elements for all remote streams ── */}
      {[...remoteStreams.entries()].map(([peerId, stream]) => (
        <RemoteAudio key={peerId} stream={stream} />
      ))}

      {/* ══ FEATURED SPEAKER (fills screen) ══ */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={featuredParticipant?.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            <FeaturedTile
              participant={featuredParticipant}
              stream={featuredStream}
              isLocal={!!featuredParticipant?.isLocal}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isVideo={isGroupVideoCall}
              speaking={featuredSpeaking}
              gradientIdx={featuredGradient}
            />
          </motion.div>
        </AnimatePresence>

        {/* ── TOP HUD (group name, timer, participant count) ── */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4 z-10"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
            >
              <div>
                <h2 className="text-white font-bold text-base leading-tight tracking-tight">{groupCallRoom?.groupName}</h2>
                <p className="text-emerald-400 text-[11px] font-semibold mt-0.5">
                  {groupCallState === 'ended' ? 'Call ended' : formatDuration(callDuration)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                <Users className="h-3.5 w-3.5 text-white/70" />
                <span className="text-white text-[11px] font-bold">{allParticipants.length}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Toast notifications ── */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-20 pointer-events-none">
          <AnimatePresence>
            {notifications.map(n => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                className="px-4 py-2 rounded-full bg-black/70 backdrop-blur-xl border border-white/10 text-xs text-white/80 font-medium shadow-xl whitespace-nowrap"
              >
                {n.msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* ── THUMBNAIL STRIP (horizontal scrollable row at bottom of video) ── */}
        <AnimatePresence>
          {thumbnailParticipants.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-4 left-0 right-0 flex justify-center px-4 z-10"
            >
              <div className="flex gap-2 overflow-x-auto max-w-full pb-1 scrollbar-hide">
                <AnimatePresence>
                  {thumbnailParticipants.map((p, idx) => {
                    const stream = p.isLocal ? localStream : remoteStreams.get(p.id);
                    const speaking = p.isLocal ? speakingMap.get('local') : speakingMap.get(p.id);
                    const gradIdx = allParticipants.findIndex(a => a.id === p.id);
                    return (
                      <ThumbnailTile
                        key={p.id}
                        participant={p}
                        stream={stream}
                        isLocal={!!p.isLocal}
                        isMuted={isMuted}
                        isCameraOff={isCameraOff}
                        isVideo={isGroupVideoCall}
                        speaking={speaking}
                        gradientIdx={gradIdx}
                        isActive={pinnedId === p.id}
                        onClick={() => setPinnedId(prev => prev === p.id ? null : p.id)}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══ CONTROLS BAR ══ */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 px-6 pt-4 pb-8 flex items-center justify-center gap-5 z-10"
            style={{ background: 'linear-gradient(to top, rgba(5,12,26,0.98) 0%, transparent 100%)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Mute toggle */}
            <ControlBtn
              on={!isMuted}
              onIcon={<Mic className="h-5 w-5" />}
              offIcon={<MicOff className="h-5 w-5" />}
              onLabel="Mic on"
              offLabel="Muted"
              onColor="bg-white/15 hover:bg-white/25 text-white"
              offColor="bg-red-500/25 hover:bg-red-500/35 text-red-400 border border-red-500/40"
              onClick={toggleGroupMute}
            />

            {/* Camera toggle (video calls only) */}
            {isGroupVideoCall && (
              <ControlBtn
                on={!isCameraOff}
                onIcon={<Video className="h-5 w-5" />}
                offIcon={<VideoOff className="h-5 w-5" />}
                onLabel="Camera on"
                offLabel="Camera off"
                onColor="bg-white/15 hover:bg-white/25 text-white"
                offColor="bg-red-500/25 hover:bg-red-500/35 text-red-400 border border-red-500/40"
                onClick={toggleGroupCamera}
              />
            )}

            {/* Leave call */}
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.93 }}
              onClick={leaveGroupCall}
              className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-2xl shadow-red-500/40 transition mx-2"
              aria-label="Leave call"
            >
              <PhoneOff className="h-6 w-6 text-white" />
            </motion.button>

            {/* Unpin / pin current featured speaker */}
            <ControlBtn
              on={!pinnedId}
              onIcon={<Maximize2 className="h-5 w-5" />}
              offIcon={<Maximize2 className="h-5 w-5" />}
              onLabel="Auto speaker"
              offLabel="Pinned"
              onColor="bg-white/15 hover:bg-white/25 text-white"
              offColor="bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-400 border border-emerald-500/40"
              onClick={() => setPinnedId(null)}
            />

            {/* Participant count pill */}
            <div className="flex flex-col items-center gap-1">
              <div className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{allParticipants.length}</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-medium">People</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Reusable control button ───────────────────────────────── */
function ControlBtn({ on, onIcon, offIcon, onLabel, offLabel, onColor, offColor, onClick }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.button
        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.93 }}
        onClick={onClick}
        className={`h-14 w-14 rounded-full flex items-center justify-center transition ${on ? onColor : offColor}`}
        aria-label={on ? onLabel : offLabel}
      >
        {on ? onIcon : offIcon}
      </motion.button>
      <span className="text-[10px] text-zinc-400 font-medium">{on ? onLabel : offLabel}</span>
    </div>
  );
}
