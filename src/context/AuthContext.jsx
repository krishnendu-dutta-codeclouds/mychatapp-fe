import React, { createContext, useState, useEffect, useContext } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, hasValidConfig } from '../config/firebase.js';
import { Browser } from '@capacitor/browser';

const onlineApiFallback = (import.meta.env.VITE_API_URL || 'https://mychatapp-be-z1nx.onrender.com').replace(/\/+$/, '');

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [accessToken, setAccessToken] = useState(() => {
    try {
      return localStorage.getItem('accessToken') || null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [apiBase, setApiBase] = useState(() => {
    return (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '');
  });
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);

  // Theme management (light/dark mode)
  const [theme, setTheme] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed) {
          if (parsed.theme) return parsed.theme;
          if (parsed.email) {
            const savedEmailTheme = localStorage.getItem(`theme-${parsed.email}`);
            if (savedEmailTheme) return savedEmailTheme;
          }
          if (parsed.id) {
            const savedIdTheme = localStorage.getItem(`theme-${parsed.id}`);
            if (savedIdTheme) return savedIdTheme;
          }
        }
      }
    } catch (e) {}
    return localStorage.getItem('theme') || 'dark';
  });

  // Dynamic user theme and font size preferences (stored per-user in local storage)
  const [themeColor, setThemeColor] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed) {
          if (parsed.themeColor) return parsed.themeColor;
          if (parsed.email) {
            const savedEmailColor = localStorage.getItem(`themeColor-${parsed.email}`);
            if (savedEmailColor) return savedEmailColor;
          }
          if (parsed.id) {
            const savedIdColor = localStorage.getItem(`themeColor-${parsed.id}`);
            if (savedIdColor) return savedIdColor;
          }
        }
      }
    } catch (e) {}
    return localStorage.getItem('themeColor') || 'green';
  });

  const [fontSize, setFontSize] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed) {
          if (parsed.fontSize) return parsed.fontSize;
          if (parsed.email) {
            const savedEmailSize = localStorage.getItem(`fontSize-${parsed.email}`);
            if (savedEmailSize) return savedEmailSize;
          }
          if (parsed.id) {
            const savedIdSize = localStorage.getItem(`fontSize-${parsed.id}`);
            if (savedIdSize) return savedIdSize;
          }
        }
      }
    } catch (e) {}
    return localStorage.getItem('fontSize') || 'medium';
  });

  const [chatBgPattern, setChatBgPattern] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed) {
          if (parsed.chatBgPattern) return parsed.chatBgPattern;
          if (parsed.email) {
            const saved = localStorage.getItem(`chatBgPattern-${parsed.email}`);
            if (saved) return saved;
          }
          if (parsed.id) {
            const saved = localStorage.getItem(`chatBgPattern-${parsed.id}`);
            if (saved) return saved;
          }
        }
      }
    } catch (e) {}
    return localStorage.getItem('chatBgPattern') || 'dots';
  });

  useEffect(() => {
    if (user) {
      const savedTheme = user.theme || (user.email && localStorage.getItem(`theme-${user.email}`)) || localStorage.getItem(`theme-${user.id}`) || 'dark';
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      const savedColor = user.themeColor || (user.email && localStorage.getItem(`themeColor-${user.email}`)) || localStorage.getItem(`themeColor-${user.id}`) || 'green';
      const savedSize = user.fontSize || (user.email && localStorage.getItem(`fontSize-${user.email}`)) || localStorage.getItem(`fontSize-${user.id}`) || 'medium';
      
      setThemeColor(savedColor);
      setFontSize(savedSize);

      // Clean up previous theme/size classes
      const rootClasses = document.documentElement.classList;
      const classesToRemove = [];
      rootClasses.forEach(className => {
        if (className.startsWith('theme-') || className.startsWith('font-size-')) {
          classesToRemove.push(className);
        }
      });
      classesToRemove.forEach(cls => rootClasses.remove(cls));

      rootClasses.add(`theme-${savedColor}`);
      rootClasses.add(`font-size-${savedSize}`);
    } else {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Defaults if not logged in
      const rootClasses = document.documentElement.classList;
      const classesToRemove = [];
      rootClasses.forEach(className => {
        if (className.startsWith('theme-') || className.startsWith('font-size-')) {
          classesToRemove.push(className);
        }
      });
      classesToRemove.forEach(cls => rootClasses.remove(cls));
      rootClasses.add('theme-green');
      rootClasses.add('font-size-medium');
    }
  }, [user]);

  const updateAppearance = async (color, size, bgPattern) => {
    if (user) {
      // Save locally first for instant feedback
      setThemeColor(color);
      setFontSize(size);
      if (bgPattern !== undefined) setChatBgPattern(bgPattern);
      
      const rootClasses = document.documentElement.classList;
      
      const themeClasses = [];
      const sizeClasses = [];
      rootClasses.forEach(className => {
        if (className.startsWith('theme-')) themeClasses.push(className);
        if (className.startsWith('font-size-')) sizeClasses.push(className);
      });
      themeClasses.forEach(cls => rootClasses.remove(cls));
      sizeClasses.forEach(cls => rootClasses.remove(cls));
      
      rootClasses.add(`theme-${color}`);
      rootClasses.add(`font-size-${size}`);

      if (user.email) {
        localStorage.setItem(`themeColor-${user.email}`, color);
        localStorage.setItem(`fontSize-${user.email}`, size);
        if (bgPattern !== undefined) localStorage.setItem(`chatBgPattern-${user.email}`, bgPattern);
      }
      if (user.id) {
        localStorage.setItem(`themeColor-${user.id}`, color);
        localStorage.setItem(`fontSize-${user.id}`, size);
        if (bgPattern !== undefined) localStorage.setItem(`chatBgPattern-${user.id}`, bgPattern);
      }

      // Persist to database via PUT /api/users/profile
      const body = { themeColor: color, fontSize: size, theme };
      if (bgPattern !== undefined) body.chatBgPattern = bgPattern;
      const response = await apiFetch('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const data = await handleResponse(response);
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    }
  };

  const updateThemeColor = (color) => {
    updateAppearance(color, fontSize).catch(err => console.error('Failed to sync theme color:', err));
  };

  const updateFontSize = (size) => {
    updateAppearance(themeColor, size).catch(err => console.error('Failed to sync font size:', err));
  };

  // Helper to safely parse JSON response and handle HTTP errors gracefully
  const handleResponse = async (res) => {
    const contentType = res.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (err) {
        data = null;
      }
    }

    if (!res.ok) {
      const errorMsg = (data && data.error) || `Request failed with status ${res.status}`;
      throw new Error(errorMsg);
    }

    if (res.status !== 204 && (!contentType || !contentType.includes('application/json'))) {
      throw new Error(`Expected JSON response but received content-type: ${contentType || 'none'}`);
    }

    return data;
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (user) {
      localStorage.setItem(`theme-${user.email}`, newTheme);
      localStorage.setItem(`theme-${user.id}`, newTheme);
      
      // Update database
      apiFetch('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ theme: newTheme })
      }).then(async (response) => {
        const data = await handleResponse(response);
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      }).catch(err => console.error('Failed to sync theme:', err));
    } else {
      localStorage.setItem('theme', newTheme);
    }
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Helper for authenticated API calls
  const apiFetch = async (url, options = {}) => {
    // Inject Authorization header if token exists
    // Omit Content-Type if the body is FormData so the browser automatically sets the boundary
    const headers = {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const config = {
      ...options,
      headers,
    };

    let response = await fetch(`${apiBase}${url}`, config);

    // If unauthorized (expired access token), try to refresh
    if (response.status === 401 && accessToken) {
      try {
        console.log('Access token expired. Requesting refresh...');
        const storedRefreshToken = localStorage.getItem('refreshToken');
        const refreshResponse = await fetch(`${apiBase}/api/auth/token/refresh`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedRefreshToken || ''}`
          },
        });

        if (refreshResponse.ok) {
          const data = await handleResponse(refreshResponse);
          setAccessToken(data.accessToken);
          setUser(data.user);
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken || storedRefreshToken);
          localStorage.setItem('user', JSON.stringify(data.user));

          // Retry the original request with new token
          headers['Authorization'] = `Bearer ${data.accessToken}`;
          response = await fetch(`${apiBase}${url}`, config);
        } else {
          // Refresh failed (refresh token expired) -> force logout
          console.warn('Session expired. Logging out.');
          logoutState();
        }
      } catch (err) {
        console.error('Error refreshing token:', err);
        logoutState();
      }
    }

    return response;
  };

  const getAvatarUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    return `${apiBase.replace(/\/+$/, '')}${url}`;
  };

  // Build list of candidate local backend URLs to probe.
  // On the same machine we try localhost / 127.0.0.1; when the page is
  // loaded from a different host (e.g. deployed Vercel site, mobile browser)
  // we additionally try the user's LAN IP so a dev backend running on
  // their laptop is still reachable from a phone on the same Wi-Fi.
  const buildLocalCandidates = () => {
    const candidates = new Set();

    const push = (host) => {
      if (!host) return;
      candidates.add(`http://${host}:5001`);
    };

    // 1. The page's own hostname (works on `npm run dev`)
    if (window.location.hostname) push(window.location.hostname);

    // 2. Loopback aliases (always works when running on the same machine)
    push('localhost');
    push('127.0.0.1');
    push('[::1]');

    // 3. If we can infer the user's LAN IP (e.g. 192.168.1.42) try that too.
    //    We get this hint from the public STUN servers used by WebRTC.
    return new Promise((resolve) => {
      const finalize = () => resolve(Array.from(candidates));

      try {
        // Only attempt ICE candidate gathering if RTCPeerConnection is available.
        if (typeof RTCPeerConnection === 'undefined') return finalize();

        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        let resolved = false;

        const finish = (extraHost) => {
          if (resolved) return;
          resolved = true;
          try { pc.close(); } catch (_) {}
          if (extraHost) push(extraHost);
          finalize();
        };

        pc.onicecandidate = (e) => {
          if (!e || !e.candidate || !e.candidate.candidate) return;
          const match = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/.exec(e.candidate.candidate);
          if (match && match[1]) finish(match[1]);
        };

        pc.createDataChannel('');
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .catch(() => finish(null));

        // Safety net: if no candidate arrives in 1.5s, proceed without it
        setTimeout(() => finish(null), 1500);
      } catch (_) {
        finalize();
      }
    });
  };

  // Race a list of local URLs against the online fallback — pick the first
  // one that responds OK to /api/health within the per-request timeout.
  const resolveBackend = async () => {
    const configuredApi = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '');
    const candidates = await buildLocalCandidates();

    const probe = (url, timeoutMs) => new Promise((resolve) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      fetch(`${url}/api/health`, { method: 'GET', signal: controller.signal, mode: 'cors' })
        .then((res) => {
          clearTimeout(timer);
          if (res.ok) resolve(url);
          else resolve(null);
        })
        .catch(() => {
          clearTimeout(timer);
          resolve(null);
        });
    });

    // Race all candidates in parallel
    const probes = candidates.map((url) => probe(url, 2000));
    const firstHit = await Promise.race([
      ...probes,
      // Fallback timeout — if nothing responds in 2.5s use the configured/online URL
      new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);

    if (firstHit) return firstHit;

    // Use the online fallback (or any configured non-local URL)
    if (!configuredApi.includes('localhost') && !configuredApi.includes('127.0.0.1')) {
      return configuredApi;
    }
    return onlineApiFallback;
  };

  // Perform dynamic backend selection and silent authentication check on mount
  useEffect(() => {
    const initAndCheckAuth = async () => {
      const activeApi = await resolveBackend();

      setApiBase(activeApi);
      const isLocal = activeApi.includes('localhost') || activeApi.includes('127.0.0.1');
      console.log(
        `%c🌐 Resolved backend target: ${isLocal ? 'LOCAL' : 'ONLINE'}`,
        'color: #10b981; font-weight: bold; font-size: 12px; padding: 4px; border-radius: 4px;'
      );

      // Perform silent authentication check using resolved API base
      try {
        const storedRefreshToken = localStorage.getItem('refreshToken');
        if (!storedRefreshToken) {
          logoutState();
          setLoading(false);
          return;
        }

        const response = await fetch(`${activeApi}/api/auth/token/refresh`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedRefreshToken}`
          },
        });

        if (response.ok) {
          const data = await handleResponse(response);
          setAccessToken(data.accessToken);
          setUser(data.user);
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken || storedRefreshToken);
          localStorage.setItem('user', JSON.stringify(data.user));
        } else {
          // Refresh failed (refresh token expired) -> force logout
          console.warn('Session expired. Logging out.');
          logoutState();
        }
      } catch (err) {
        console.log('Silent auth check failed (not logged in).', err);
      } finally {
        setLoading(false);
      }
    };

    initAndCheckAuth();
  }, []);

  const requestOtp = async (email, mode = 'login') => {
    const response = await fetch(`${apiBase}/api/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, mode }),
    });

    const data = await handleResponse(response);

    if (data.status === 'admin_auto_login') {
      setAccessToken(data.accessToken);
      setUser(data.user);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data; // Returns otp in dev mode
  };

  const verifyOtp = async (email, otp, displayName = null, bio = null) => {
    const response = await fetch(`${apiBase}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, displayName, bio }),
    });

    const data = await handleResponse(response);
    setAccessToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  };

  const loginWithGoogle = async () => {
    const isMockConfig = !hasValidConfig;

    // Check if running inside mobile WebView wrapper (native Capacitor runtime)
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      console.log('📱 Mobile runtime detected: Redirecting Google Login to system browser...');
      const params = new URLSearchParams({
        isMock: isMockConfig ? 'true' : 'false',
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
        appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
      });
      const gatewayUrl = `${apiBase}/mobile-login-gateway?${params.toString()}`;
      await Browser.open({ url: gatewayUrl });
      return;
    }

    let idToken;
    let isMockUsed = false;

    if (isMockConfig && import.meta.env.DEV) {
      console.warn('⚠️ Firebase Client config contains example placeholders. Using mock Google login for development.');
      idToken = 'mock_google_id_token';
      isMockUsed = true;
    } else if (!auth || !googleProvider) {
      throw new Error('Google Sign-In is unavailable. Firebase is not configured — please set valid VITE_FIREBASE_* environment variables.');
    } else {
      // 1. Trigger Google login popup via Firebase Client SDK
      const userCredential = await signInWithPopup(auth, googleProvider);
      
      // 2. Retrieve cryptographically signed Google ID Token
      idToken = await userCredential.user.getIdToken();
    }

    // 3. Send ID Token to Express API Gateway
    const response = await fetch(`${apiBase}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    let data;
    try {
      data = await handleResponse(response);
    } catch (err) {
      if (!isMockUsed && auth) {
        try {
          await auth.signOut();
        } catch (signOutErr) {
          console.error('Error signing out after failed verification:', signOutErr);
        }
      }
      throw err;
    }

    setAccessToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  };

  const completeTokenLogin = async (newAccessToken, newRefreshToken) => {
    setLoading(true);
    try {
      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      
      const response = await fetch(`${apiBase}/api/users/profile`, {
        headers: {
          'Authorization': `Bearer ${newAccessToken}`
        }
      });
      if (response.ok) {
        const userData = await handleResponse(response);
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        setAccessToken(newAccessToken);
        console.log('🎉 Android WebView token authentication succeeded!');
      } else {
        throw new Error('Failed to fetch user with deep linked token.');
      }
    } catch (err) {
      console.error('Failed to complete deep link token login:', err);
      logoutState();
    } finally {
      setLoading(false);
    }
  };

  const registerWithPassword = async (email, password, displayName, bio = null, otp = null) => {
    const response = await fetch(`${apiBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, bio, otp }),
    });

    const data = await handleResponse(response);
    setAccessToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  };

  const loginWithPassword = async (email, password) => {
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await handleResponse(response);
    
    // If 2FA is required, do NOT set user/token yet. Return to trigger OTP UI.
    if (data.status === '2fa_required') {
      return data;
    }

    setAccessToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  };

  const verify2fa = async (email, otp) => {
    const response = await fetch(`${apiBase}/api/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    const data = await handleResponse(response);
    setAccessToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  };

  const updateSecuritySettings = async (password, twoFactorEnabled) => {
    const response = await apiFetch('/api/users/profile/security', {
      method: 'PUT',
      body: JSON.stringify({ password, twoFactorEnabled }),
    });

    const data = await handleResponse(response);
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const logoutState = () => {
    // Preserve current theme, themeColor, and fontSize of this specific user before clearing
    const currentTheme = user ? (localStorage.getItem(`theme-${user.email}`) || localStorage.getItem(`theme-${user.id}`)) : localStorage.getItem('theme');
    const currentColor = user ? (localStorage.getItem(`themeColor-${user.email}`) || localStorage.getItem(`themeColor-${user.id}`)) : localStorage.getItem('themeColor');
    const currentSize = user ? (localStorage.getItem(`fontSize-${user.email}`) || localStorage.getItem(`fontSize-${user.id}`)) : localStorage.getItem('fontSize');
    const userEmail = user?.email;
    const userId = user?.id;

    setUser(null);
    setAccessToken(null);

    // Clear all client-side storage & caches
    try {
      // Clear sessionStorage
      sessionStorage.clear();

      // Clear localStorage but preserve user's theme preference to avoid visual flashing
      localStorage.clear();
      if (currentTheme) {
        localStorage.setItem('theme', currentTheme);
        if (userEmail) localStorage.setItem(`theme-${userEmail}`, currentTheme);
        if (userId) localStorage.setItem(`theme-${userId}`, currentTheme);
      }
      if (currentColor) {
        localStorage.setItem('themeColor', currentColor);
        if (userEmail) localStorage.setItem(`themeColor-${userEmail}`, currentColor);
        if (userId) localStorage.setItem(`themeColor-${userId}`, currentColor);
      }
      if (currentSize) {
        localStorage.setItem('fontSize', currentSize);
        if (userEmail) localStorage.setItem(`fontSize-${userEmail}`, currentSize);
        if (userId) localStorage.setItem(`fontSize-${userId}`, currentSize);
      }

      // Clear Cache Storage (Cache API) to purge any cached assets or API responses
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            caches.delete(name);
          });
        });
      }
    } catch (err) {
      console.error('Error clearing client caches on logout:', err);
    }
  };

  const logout = async () => {
    try {
      // Sign out from Firebase Client SDK to clear Google OAuth session state
      if (auth) await auth.signOut();
    } catch (firebaseErr) {
      console.error('Error signing out of Firebase SDK:', firebaseErr);
    }

    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Error on logout API call:', err);
    } finally {
      logoutState();
    }
  };

  const updateProfile = async (displayName, bio, avatarFile) => {
    const formData = new FormData();
    if (displayName) formData.append('displayName', displayName);
    if (bio) formData.append('bio', bio);
    if (avatarFile) formData.append('avatar', avatarFile);

    const response = await apiFetch('/api/users/profile', {
      method: 'PUT',
      body: formData,
    });

    const data = await handleResponse(response);
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const deleteAccount = async () => {
    const response = await apiFetch('/api/users/profile', {
      method: 'DELETE',
    });

    await handleResponse(response);
    logoutState();
  };

  const value = {
    user,
    accessToken,
    loading,
    apiBase,
    isLocalBackend: apiBase.includes('localhost') || apiBase.includes('127.0.0.1'),
    isAdminPortalOpen,
    setIsAdminPortalOpen,
    requestOtp,
    verifyOtp,
    loginWithGoogle,
    completeTokenLogin,
    logout,
    updateProfile,
    apiFetch,
    registerWithPassword,
    loginWithPassword,
    verify2fa,
    updateSecuritySettings,
    theme,
    toggleTheme,
    deleteAccount,
    handleResponse,
    themeColor,
    updateThemeColor,
    fontSize,
    updateFontSize,
    getAvatarUrl,
    updateAppearance,
    chatBgPattern,
    setChatBgPattern,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
