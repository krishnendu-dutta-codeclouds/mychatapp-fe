import React, { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { showNotification } from '../utils/notifications.js';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { socket, connected: socketConnected } = useSocket();
  const { user, apiBase, accessToken } = useAuth();

  // Call States: 'idle', 'dialing' (outgoing), 'ringing' (incoming), 'connected' (active), 'ended'
  const [callState, setCallState] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Call participant details
  const [callerDetails, setCallerDetails] = useState(null); // { id, name, avatarUrl }
  const [calleeDetails, setCalleeDetails] = useState(null); // { id, name, avatarUrl }

  // Refs for WebRTC connections and media streams
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const endCallRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);

  // States for binding to video elements reactively
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // Audio tone generator states
  const audioContextRef = useRef(null);
  const soundIntervalRef = useRef(null);

  // ICE Server configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Ensure remote audio element is ready
  useEffect(() => {
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.style.display = 'none';
    document.body.appendChild(audio);
    remoteAudioRef.current = audio;

    return () => {
      document.body.removeChild(audio);
    };
  }, []);

  // Timer stopwatch for active connected calls
  useEffect(() => {
    let interval = null;
    if (callState === 'connected') {
      setCallDuration(0);
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  const callerDetailsRef = useRef(null);
  const calleeDetailsRef = useRef(null);
  const callStateRef = useRef('idle');
  const callDurationRef = useRef(0);
  const isVideoCallRef = useRef(false);

  useEffect(() => {
    callerDetailsRef.current = callerDetails;
    calleeDetailsRef.current = calleeDetails;
    callStateRef.current = callState;
  }, [callerDetails, calleeDetails, callState]);

  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);

  useEffect(() => {
    isVideoCallRef.current = isVideoCall;
  }, [isVideoCall]);

  const logCallEnded = useCallback((statusOverride) => {
    const caller = callerDetailsRef.current;
    const callee = calleeDetailsRef.current;
    const state = callStateRef.current;
    const durationVal = callDurationRef.current;
    const callType = isVideoCallRef.current ? 'video' : 'audio';

    // Only the call initiator should submit the log to avoid double-logging
    const isInitiator = caller?.id === user?.id;
    if (!isInitiator || !callee?.id) return;

    let logStatus = 'missed';
    if (state === 'connected' || statusOverride === 'connected') {
      logStatus = 'connected';
    }

    console.log(`📡 Logging ${callType} call history: ${user.id} -> ${callee.id} (${logStatus}, duration: ${durationVal}s)`);

    fetch(`${apiBase || ''}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        callerId: user.id,
        receiverId: callee.id,
        status: logStatus,
        duration: durationVal,
        callType
      })
    }).catch(err => console.warn('⚠️ Call log failed:', err));
  }, [user, apiBase, accessToken]);

  // Clean up sounds on call state changes
  useEffect(() => {
    stopSound();
    if (callState === 'dialing') {
      playDialTone();
    } else if (callState === 'ringing') {
      playRingTone();
    }
    return () => stopSound();
  }, [callState]);

  // Web Audio API Synthesizer to play telephony sound effects (dialing, ringing, hangup, busy)
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playOscillators = (freq1, freq2, duration, volume = 0.05) => {
    try {
      initAudioContext();
      const ctx = audioContextRef.current;
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.frequency.value = freq1;
      osc2.frequency.value = freq2;
      
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start();
      osc2.start();

      osc1.stop(ctx.currentTime + duration);
      osc2.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio tone play failed:', e);
    }
  };

  const playDialTone = () => {
    stopSound();
    const dialPattern = () => {
      playOscillators(440, 480, 1.5, 0.03);
    };
    dialPattern();
    soundIntervalRef.current = setInterval(dialPattern, 5000);
  };

  const playRingTone = () => {
    stopSound();
    const ringPattern = () => {
      playOscillators(400, 450, 1.2, 0.08);
      setTimeout(() => {
        playOscillators(400, 450, 1.2, 0.08);
      }, 1500);
    };
    ringPattern();
    soundIntervalRef.current = setInterval(ringPattern, 5000);
  };

  const playBeepTone = (frequency, duration) => {
    playOscillators(frequency, frequency, duration, 0.07);
  };

  const stopSound = () => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
  };

  // Close connection and dispose tracks
  const cleanUpMedia = useCallback(() => {
    console.log('🧹 Cleaning up WebRTC media and peer connection');
    stopSound();
    
    // Stop local media track inputs (audio + video)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Terminate PeerConnection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    remoteStreamRef.current = null;
    iceCandidatesQueueRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  const processIceQueue = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) return;
    
    console.log(`📡 Processing ${iceCandidatesQueueRef.current.length} queued remote ICE candidates...`);
    while (iceCandidatesQueueRef.current.length > 0) {
      const candidate = iceCandidatesQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('⚠️ Error adding queued remote ICE candidate:', e.message);
      }
    }
  }, []);

  // WebRTC ICE Candidate Listener
  const handleIceCandidate = useCallback((event, targetUserId) => {
    if (event.candidate && socket) {
      console.log('📡 Generating ICE candidate, sending to:', targetUserId);
      socket.emit('ice_candidate', {
        to: targetUserId,
        candidate: event.candidate
      });
    }
  }, [socket]);

  // Initializing Peer Connection
  const createPeerConnection = useCallback((targetUserId) => {
    console.log('📡 Instantiating RTCPeerConnection for:', targetUserId);
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (e) => handleIceCandidate(e, targetUserId);

    pc.ontrack = (e) => {
      console.log('📡 WebRTC track received from peer. Kind:', e.track.kind, 'Streams count:', e.streams.length);
      
      let stream = e.streams[0];
      if (!stream) {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(e.track);
        stream = remoteStreamRef.current;
      } else {
        remoteStreamRef.current = stream;
      }

      // Instantiate a new MediaStream reactively so that the video element
      // is notified when multiple tracks (audio then video) arrive at separate times.
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
      
      // Attach audio stream
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
    };

    // Connection state failure handler (replaces fragile socket drop check)
    const handleConnectionFailure = () => {
      const state = pc.connectionState || pc.iceConnectionState;
      console.log(`📡 RTCPeerConnection State changed: ${state}`);
      if (state === 'failed') {
        // Wait a brief moment to check if it's a transient disconnect or absolute failure
        setTimeout(() => {
          if (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed') {
            console.log('📡 WebRTC peer connection failure confirmed. Ending call.');
            if (endCallRef.current) endCallRef.current();
          }
        }, 3000);
      }
    };

    pc.onconnectionstatechange = handleConnectionFailure;
    pc.oniceconnectionstatechange = handleConnectionFailure;

    // Add local media tracks if stream exists
    if (localStreamRef.current) {
      console.log('📡 Adding local stream tracks to RTCPeerConnection:', localStreamRef.current.getTracks().length);
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
      console.warn('⚠️ No local stream found while creating peer connection.');
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [handleIceCandidate]);

  // Start Call (Caller Action) - supports both audio and video
  const startCall = useCallback(async (targetUserId, targetUserName, avatarUrl, callType = 'audio') => {
    if (!socket || !user) {
      console.error('⚠️ Cannot start call: socket or user is undefined.', { socket: !!socket, user: !!user });
      return;
    }
    
    const isVideo = callType === 'video';
    console.log(`📡 Starting outbound ${callType} call to ${targetUserName} (${targetUserId})`);
    initAudioContext();
    setCallState('dialing');
    setIsVideoCall(isVideo);
    setIsCameraOff(false);
    setCalleeDetails({ id: targetUserId, name: targetUserName, avatarUrl });
    setCallerDetails({ id: user.id, name: user.displayName, avatarUrl: user.avatarUrl });

    try {
      // 1. Fetch media stream input (audio only, or audio + video)
      const constraints = isVideo
        ? { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: true };
      
      console.log(`📡 Requesting ${isVideo ? 'camera + microphone' : 'microphone'} permissions...`);
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('⚠️ getUserMedia with preferred constraints failed. Trying fallback...', err);
        if (isVideo) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } else {
          throw err;
        }
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      console.log(`📡 Media stream obtained. Tracks: ${stream.getTracks().map(t => t.kind).join(', ')}`);

      // 2. Initialize Peer Connection (adds local tracks immediately)
      const pc = createPeerConnection(targetUserId);

      // 3. Create WebRTC offer
      console.log('📡 Creating WebRTC SDP offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Send calling signal to target
      console.log('📡 Emitting call_user event to backend...');
      socket.emit('call_user', {
        userToCall: targetUserId,
        signalData: { type: offer.type, sdp: offer.sdp },
        from: user.id,
        name: user.displayName,
        avatarUrl: user.avatarUrl,
        callType
      });
    } catch (err) {
      console.error('❌ Call initialization failed:', err);
      if (!window.isSecureContext) {
        alert('WebRTC camera/microphone access is blocked on non-secure connections. Please serve your application over HTTPS or access it via localhost.');
      } else {
        alert(`Unable to access ${isVideo ? 'camera/microphone' : 'microphone'}. Please verify device permissions.`);
      }
      setCallState('idle');
      setIsVideoCall(false);
      cleanUpMedia();
    }
  }, [socket, user, createPeerConnection, cleanUpMedia]);

  // Accept Call (Callee Action)
  const acceptCall = useCallback(async () => {
    if (!socket || !callerDetails) {
      console.error('⚠️ Cannot accept call: socket or callerDetails is undefined.');
      return;
    }

    const isVideo = isVideoCall;
    console.log(`📡 Accepting incoming ${isVideo ? 'video' : 'audio'} call from ${callerDetails.name} (${callerDetails.id})`);
    initAudioContext();
    setCallState('connected');

    try {
      // 1. Fetch callee media stream matching call type
      const constraints = isVideo
        ? { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: true };

      console.log(`📡 Requesting ${isVideo ? 'camera + microphone' : 'microphone'} permissions for callee...`);
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('⚠️ Callee getUserMedia with preferred constraints failed. Trying fallback...', err);
        if (isVideo) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          } catch (fallbackErr) {
            console.warn('⚠️ Callee has no webcam/camera or blocked permission. Falling back to audio-only stream...', fallbackErr);
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsCameraOff(true);
          }
        } else {
          throw err;
        }
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      console.log('📡 Callee media stream obtained.');

      // 2. Initialize callee Peer Connection
      const pc = createPeerConnection(callerDetails.id);

      // 3. Set remote WebRTC offer description
      console.log('📡 Setting remote SDP offer description...', callerDetails.signal?.type);
      await pc.setRemoteDescription(new RTCSessionDescription(callerDetails.signal));
      await processIceQueue();

      // 4. Create callee Answer description
      console.log('📡 Creating WebRTC SDP answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 5. Signal acceptance answer to caller
      console.log('📡 Emitting answer_call event to backend...');
      socket.emit('answer_call', {
        to: callerDetails.id,
        signal: { type: answer.type, sdp: answer.sdp }
      });
    } catch (err) {
      console.error('❌ Failed to accept WebRTC session:', err);
      if (!window.isSecureContext) {
        alert('WebRTC camera/microphone access is blocked on non-secure connections. Please serve your application over HTTPS or access it via localhost.');
      } else {
        alert('Unable to access camera or microphone to answer call. Please check device permissions.');
      }
      socket.emit('reject_call', { to: callerDetails.id });
      setCallState('idle');
      setIsVideoCall(false);
      cleanUpMedia();
    }
  }, [socket, callerDetails, createPeerConnection, cleanUpMedia, isVideoCall]);

  // Reject Call (Callee Action)
  const rejectCall = useCallback(() => {
    if (socket && callerDetails) {
      console.log(`📡 Rejecting incoming call from: ${callerDetails.id}`);
      socket.emit('reject_call', { to: callerDetails.id });
    }
    setCallState('idle');
    setCallerDetails(null);
    setIsVideoCall(false);
    cleanUpMedia();
  }, [socket, callerDetails, cleanUpMedia]);

  // End Active Session / Hangup Call (Any User)
  const endCall = useCallback(() => {
    const peerId = callState === 'dialing' || callState === 'connected'
      ? calleeDetails?.id
      : callerDetails?.id;

    console.log(`📡 Hanging up call with peer: ${peerId}`);
    if (socket && peerId) {
      socket.emit('hangup_call', { to: peerId });
    }
    
    logCallEnded();

    playBeepTone(300, 0.4);
    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setCallerDetails(null);
      setCalleeDetails(null);
      setIsVideoCall(false);
    }, 1000);
    
    cleanUpMedia();
  }, [socket, callState, callerDetails, calleeDetails, cleanUpMedia, logCallEnded]);

  // Keep endCallRef in sync
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  // Toggle audio track mute input
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log(`🎙️ Microphone mute toggled: ${!audioTrack.enabled}`);
      }
    }
  }, []);

  // Toggle camera on/off for video calls
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
        console.log(`📷 Camera toggled: ${videoTrack.enabled ? 'ON' : 'OFF'}`);
      }
    }
  }, []);

  // Listen to socket signals
  useEffect(() => {
    if (!socket) {
      console.log('🔌 CallContext: Socket not connected yet.');
      return;
    }

    console.log('🔌 Registering WebRTC calling socket listeners.');

    // A: Inbound call setup
    const handleIncomingCall = ({ from, name, avatarUrl, signal, callType }) => {
      console.log(`🔔 Inbound ${callType || 'audio'} Call Signal received from: ${name} (${from})`);
      
      // If busy, auto-reject call
      if (callState !== 'idle') {
        console.log('📡 Callee is busy. Auto-rejecting inbound call from:', from);
        socket.emit('reject_call', { to: from });
        return;
      }

      const isVideo = callType === 'video';
      setIsVideoCall(isVideo);
      setIsCameraOff(false);
      setCallState('ringing');
      setCallerDetails({ id: from, name, avatarUrl, signal });
      setCalleeDetails({ id: user?.id, name: user?.displayName, avatarUrl: user?.avatarUrl });

      // Show call push notification
      showNotification(`Incoming ${isVideo ? 'Video' : 'Voice'} Call`, {
        body: `${name} is calling you...`,
        tag: `incoming-call-${from}`,
        requireInteraction: true // Keep notification active until clicked or dismissed
      });
    };

    // B: Outbound call accepted
    const handleCallAccepted = async ({ signal }) => {
      console.log('🔔 Outbound Call accepted by callee. Setting remote session description...');
      if (peerConnectionRef.current && (callState === 'dialing' || callState === 'idle' || callState === 'connected')) {
        setCallState('connected');
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          console.log('📡 WebRTC peer connection remote SDP successfully set.');
          await processIceQueue();
        } catch (e) {
          console.error('❌ Remote SDP description set failed:', e);
        }
      } else {
        console.warn('⚠️ handleCallAccepted fired but peer connection or state is not ready:', { pc: !!peerConnectionRef.current, state: callState });
      }
    };

    // C: Call rejected by callee
    const handleCallRejected = () => {
      console.log('🔔 Call was rejected by callee.');
      logCallEnded();
      playBeepTone(400, 0.25);
      setTimeout(() => playBeepTone(400, 0.25), 350);
      setCallState('ended');
      setTimeout(() => {
        setCallState('idle');
        setCallerDetails(null);
        setCalleeDetails(null);
        setIsVideoCall(false);
      }, 1500);
      cleanUpMedia();
    };

    // D: Remote Ice Candidate received
    const handleIceCandidateEvent = async ({ candidate }) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          console.log('📡 Adding remote ICE Candidate...');
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          console.log('📡 Queueing remote ICE Candidate (PC or remoteDescription not ready)...');
          iceCandidatesQueueRef.current.push(candidate);
        }
      } catch (e) {
        console.warn('⚠️ Error adding ice candidate:', e.message);
      }
    };

    // E: Call hung up by peer
    const handlePeerHungUp = () => {
      console.log('🔔 Peer hung up the call.');
      logCallEnded();
      playBeepTone(300, 0.4);
      setCallState('ended');
      setTimeout(() => {
        setCallState('idle');
        setCallerDetails(null);
        setCalleeDetails(null);
        setIsVideoCall(false);
      }, 1000);
      cleanUpMedia();
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('ice_candidate', handleIceCandidateEvent);
    socket.on('peer_hungup', handlePeerHungUp);

    return () => {
      console.log('🔌 Removing WebRTC calling socket listeners.');
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('ice_candidate', handleIceCandidateEvent);
      socket.off('peer_hungup', handlePeerHungUp);
    };
  }, [socket, callState, user, cleanUpMedia, logCallEnded]);

  // Clean signal transmission if page is closed or refreshed
  useEffect(() => {
    const handleBeforeUnload = () => {
      endCall();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [endCall]);

  const value = {
    callState,
    isMuted,
    isVideoCall,
    isCameraOff,
    callDuration,
    callerDetails,
    calleeDetails,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
