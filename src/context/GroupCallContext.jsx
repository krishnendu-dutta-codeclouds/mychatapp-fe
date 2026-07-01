import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { showNotification } from '../utils/notifications.js';

const GroupCallContext = createContext(null);

// ICE server config
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export function GroupCallProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  // 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'
  const [groupCallState, setGroupCallState] = useState('idle');
  const [groupCallRoom, setGroupCallRoom] = useState(null);
  // { id, name, avatarUrl, stream? } array of active participants
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // peerId -> MediaStream
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isGroupVideoCall, setIsGroupVideoCall] = useState(false);
  const [notifications, setNotifications] = useState([]); // transient toasts like "X declined"
  const [callDuration, setCallDuration] = useState(0);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const peerConnections = useRef(new Map()); // peerId -> RTCPeerConnection
  const iceQueues = useRef(new Map());       // peerId -> RTCIceCandidate[]
  const localStreamRef = useRef(null);
  const groupCallRoomRef = useRef(null);
  const groupCallStateRef = useRef('idle');
  const isGroupVideoCallRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { groupCallRoomRef.current = groupCallRoom; }, [groupCallRoom]);
  useEffect(() => { groupCallStateRef.current = groupCallState; }, [groupCallState]);
  useEffect(() => { isGroupVideoCallRef.current = isGroupVideoCall; }, [isGroupVideoCall]);

  // ── Call Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    if (groupCallState === 'connected') {
      setCallDuration(0);
      timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [groupCallState]);

  // ── Notification helper ─────────────────────────────────────────────────────
  const addNotification = useCallback((msg) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, msg }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  // ── Media cleanup ───────────────────────────────────────────────────────────
  const cleanUpAll = useCallback(() => {
    // Close all peer connections
    peerConnections.current.forEach(pc => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      try { pc.close(); } catch (_) {}
    });
    peerConnections.current.clear();
    iceQueues.current.clear();

    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams(new Map());
    setParticipants([]);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  // ── Get / create local media stream ────────────────────────────────────────
  const getLocalStream = useCallback(async (isVideo) => {
    const constraints = isVideo
      ? { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }
      : { audio: true };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      if (isVideo) {
        // Retry audio-only if camera unavailable
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsCameraOff(true);
        return stream;
      }
      throw err;
    }
  }, []);

  // ── Create RTCPeerConnection for a specific peer ────────────────────────────
  const createPeerConnection = useCallback((peerId, callId) => {
    console.log(`📞 GroupCall: Creating RTCPeerConnection with peer ${peerId}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Send local ICE candidates to the peer via server relay
    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('group_ice_candidate', { to: peerId, candidate: e.candidate, callId });
      }
    };

    // Handle incoming remote tracks
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(peerId, stream);
        return next;
      });
    };

    // Handle connection failure
    const onStateChange = () => {
      const state = pc.connectionState || pc.iceConnectionState;
      if (state === 'failed') {
        console.warn(`📞 GroupCall: Peer connection to ${peerId} failed.`);
        setRemoteStreams(prev => { const n = new Map(prev); n.delete(peerId); return n; });
        peerConnections.current.delete(peerId);
        try { pc.close(); } catch (_) {}
      }
    };
    pc.onconnectionstatechange = onStateChange;
    pc.oniceconnectionstatechange = onStateChange;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [socket]);

  // ── Process queued ICE candidates for a peer ────────────────────────────────
  const drainIceQueue = useCallback(async (peerId) => {
    const pc = peerConnections.current.get(peerId);
    const queue = iceQueues.current.get(peerId) || [];
    if (!pc || !pc.remoteDescription) return;
    while (queue.length > 0) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(queue.shift()));
      } catch (_) {}
    }
    iceQueues.current.set(peerId, []);
  }, []);

  // ── 1. Start group call (initiator) ────────────────────────────────────────
  const startGroupCall = useCallback(async (group, callType = 'audio') => {
    if (!socket || !user || !group) return;
    const isVideo = callType === 'video';

    try {
      setGroupCallState('connecting');
      setIsGroupVideoCall(isVideo);

      const stream = await getLocalStream(isVideo);

      const room = {
        callId: null, // assigned by server
        groupId: group.id,
        groupName: group.name,
        initiatorId: user.id
      };
      setGroupCallRoom(room);
      setParticipants([{ id: user.id, name: user.displayName, avatarUrl: user.avatarUrl }]);

      const memberIds = (group.members || []).map(m => m.id);

      socket.emit('group_call_start', {
        groupId: group.id,
        groupName: group.name,
        memberIds,
        callType
      });

      setGroupCallState('connected');
    } catch (err) {
      console.error('❌ GroupCall: Failed to start:', err);
      setGroupCallState('idle');
      cleanUpAll();
    }
  }, [socket, user, getLocalStream, cleanUpAll]);

  // ── 2. Accept incoming group call ───────────────────────────────────────────
  const acceptGroupCall = useCallback(async () => {
    const room = groupCallRoomRef.current;
    if (!socket || !room) return;
    const isVideo = isGroupVideoCallRef.current;

    try {
      setGroupCallState('connecting');
      await getLocalStream(isVideo);
      // Add self to participants immediately so the local tile appears
      setParticipants(prev => {
        if (prev.find(p => p.id === user?.id)) return prev;
        return [{ id: user?.id, name: user?.displayName, avatarUrl: user?.avatarUrl }, ...prev];
      });
      socket.emit('group_call_accept', { groupId: room.groupId });
    } catch (err) {
      console.error('❌ GroupCall: Failed to accept:', err);
      setGroupCallState('idle');
      cleanUpAll();
    }
  }, [socket, user, getLocalStream, cleanUpAll]);

  // ── 3. Decline incoming group call ──────────────────────────────────────────
  const declineGroupCall = useCallback(() => {
    const room = groupCallRoomRef.current;
    if (!socket || !room) return;
    socket.emit('group_call_decline', { groupId: room.groupId });
    setGroupCallState('idle');
    setGroupCallRoom(null);
  }, [socket]);

  // ── 4. Leave active group call ──────────────────────────────────────────────
  const leaveGroupCall = useCallback(() => {
    const room = groupCallRoomRef.current;
    if (!room) return;
    if (socket) socket.emit('group_call_leave', { groupId: room.groupId });

    setGroupCallState('ended');
    setTimeout(() => {
      setGroupCallState('idle');
      setGroupCallRoom(null);
    }, 1500);
    cleanUpAll();
  }, [socket, cleanUpAll]);

  // ── 5. Toggle mute ──────────────────────────────────────────────────────────
  const toggleGroupMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  }, []);

  // ── 6. Toggle camera ────────────────────────────────────────────────────────
  const toggleGroupCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsCameraOff(!track.enabled);
    }
  }, []);

  // ── Socket event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Inbound: Receive group call invite
    const onIncomingGroupCall = ({ callId, groupId, groupName, initiatorId, initiatorName, initiatorAvatar, callType }) => {
      if (groupCallStateRef.current !== 'idle') return; // busy
      console.log(`🔔 GroupCall: Incoming from group "${groupName}" initiated by ${initiatorName}`);
      const isVideo = callType === 'video';
      setIsGroupVideoCall(isVideo);
      setGroupCallState('ringing');
      setGroupCallRoom({ callId, groupId, groupName, initiatorId, initiatorName, initiatorAvatar });

      // Show group call push notification
      showNotification('Incoming Group Call', {
        body: `${initiatorName} is calling in group "${groupName}"...`,
        tag: `incoming-group-call-${callId}`,
        requireInteraction: true // Keep notification active until clicked or dismissed
      });
    };

    // Server confirms we joined and tells us who is already in the room
    const onGroupCallJoined = async ({ callId, groupId, existingParticipants, callType }) => {
      console.log(`📞 GroupCall joined. Existing peers: ${existingParticipants.length}`);
      setGroupCallRoom(prev => ({ ...prev, callId, groupId }));
      setGroupCallState('connected');

      // Add existing participants to state
      setParticipants(prev => {
        const ids = new Set(prev.map(p => p.id));
        const fresh = existingParticipants.filter(p => !ids.has(p.id));
        return [...prev, ...fresh];
      });

      // As the new joiner, initiate SDP offers to each existing peer
      for (const peer of existingParticipants) {
        const pc = createPeerConnection(peer.id, callId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('group_call_offer', { to: peer.id, offer: { type: offer.type, sdp: offer.sdp }, callId });
      }
    };

    // A new peer joined — wait for their SDP offer, add them to participant list
    const onGroupCallPeerJoined = ({ peerId, peerName, peerAvatar }) => {
      console.log(`📞 GroupCall: Peer joined: ${peerName} (${peerId})`);
      setParticipants(prev => {
        if (prev.find(p => p.id === peerId)) return prev;
        return [...prev, { id: peerId, name: peerName, avatarUrl: peerAvatar }];
      });
    };

    // Receive SDP offer from a new joiner
    const onGroupCallOffer = async ({ from, offer, callId }) => {
      console.log(`📞 GroupCall: Received SDP offer from ${from}`);
      let pc = peerConnections.current.get(from);
      if (!pc) {
        pc = createPeerConnection(from, callId);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await drainIceQueue(from);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('group_call_answer', { to: from, answer: { type: answer.type, sdp: answer.sdp }, callId });
    };

    // Receive SDP answer (from the peer we offered to)
    const onGroupCallAnswer = async ({ from, answer }) => {
      console.log(`📞 GroupCall: Received SDP answer from ${from}`);
      const pc = peerConnections.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await drainIceQueue(from);
      }
    };

    // Relay ICE candidate to specific peer
    const onGroupIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnections.current.get(from);
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
      } else {
        const q = iceQueues.current.get(from) || [];
        q.push(candidate);
        iceQueues.current.set(from, q);
      }
    };

    // A peer declined (call continues for us)
    const onGroupCallPeerDeclined = ({ peerId, peerName }) => {
      addNotification(`${peerName} declined the call`);
      setParticipants(prev => prev.filter(p => p.id !== peerId));
    };

    // A peer left the call
    const onGroupCallPeerLeft = ({ peerId, peerName }) => {
      addNotification(`${peerName} left the call`);
      setParticipants(prev => prev.filter(p => p.id !== peerId));
      setRemoteStreams(prev => { const n = new Map(prev); n.delete(peerId); return n; });
      const pc = peerConnections.current.get(peerId);
      if (pc) { try { pc.close(); } catch (_) {} peerConnections.current.delete(peerId); }
    };

    // Server-forced call end (e.g. no_room)
    const onGroupCallEnded = ({ reason }) => {
      console.log(`📞 GroupCall ended by server. Reason: ${reason}`);
      setGroupCallState('ended');
      setTimeout(() => { setGroupCallState('idle'); setGroupCallRoom(null); }, 1500);
      cleanUpAll();
    };

    socket.on('incoming_group_call', onIncomingGroupCall);
    socket.on('group_call_joined', onGroupCallJoined);
    socket.on('group_call_peer_joined', onGroupCallPeerJoined);
    socket.on('group_call_offer', onGroupCallOffer);
    socket.on('group_call_answer', onGroupCallAnswer);
    socket.on('group_ice_candidate', onGroupIceCandidate);
    socket.on('group_call_peer_declined', onGroupCallPeerDeclined);
    socket.on('group_call_peer_left', onGroupCallPeerLeft);
    socket.on('group_call_ended', onGroupCallEnded);

    return () => {
      socket.off('incoming_group_call', onIncomingGroupCall);
      socket.off('group_call_joined', onGroupCallJoined);
      socket.off('group_call_peer_joined', onGroupCallPeerJoined);
      socket.off('group_call_offer', onGroupCallOffer);
      socket.off('group_call_answer', onGroupCallAnswer);
      socket.off('group_ice_candidate', onGroupIceCandidate);
      socket.off('group_call_peer_declined', onGroupCallPeerDeclined);
      socket.off('group_call_peer_left', onGroupCallPeerLeft);
      socket.off('group_call_ended', onGroupCallEnded);
    };
  }, [socket, createPeerConnection, drainIceQueue, addNotification, cleanUpAll]);

  // Clean up on page unload
  useEffect(() => {
    const onUnload = () => leaveGroupCall();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [leaveGroupCall]);

  const value = {
    groupCallState,
    groupCallRoom,
    participants,
    localStream,
    remoteStreams,
    isMuted,
    isCameraOff,
    isGroupVideoCall,
    callDuration,
    notifications,
    startGroupCall,
    acceptGroupCall,
    declineGroupCall,
    leaveGroupCall,
    toggleGroupMute,
    toggleGroupCamera
  };

  return (
    <GroupCallContext.Provider value={value}>
      {children}
    </GroupCallContext.Provider>
  );
}

export function useGroupCall() {
  const ctx = useContext(GroupCallContext);
  if (!ctx) throw new Error('useGroupCall must be used within a GroupCallProvider');
  return ctx;
}
