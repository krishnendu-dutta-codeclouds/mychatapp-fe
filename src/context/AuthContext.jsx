import React, { createContext, useState, useEffect, useContext } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase.js';

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);

  // Theme management (light/dark mode)
  const [theme, setTheme] = useState('dark');

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

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
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
        const refreshResponse = await fetch(`${apiBase}/api/auth/token/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (refreshResponse.ok) {
          const data = await handleResponse(refreshResponse);
          setAccessToken(data.accessToken);
          setUser(data.user);

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

  // Perform silent authentication check on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${apiBase}/api/auth/token/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await handleResponse(response);
          setAccessToken(data.accessToken);
          setUser(data.user);
        }
      } catch (err) {
        console.log('Silent auth check failed (not logged in).');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
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
    return data;
  };

  const loginWithGoogle = async () => {
    const isMockConfig = !import.meta.env.VITE_FIREBASE_API_KEY || 
                         import.meta.env.VITE_FIREBASE_API_KEY.includes('example') || 
                         (import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_PROJECT_ID.includes('example'));

    let idToken;
    let isMockUsed = false;

    if (isMockConfig && import.meta.env.DEV) {
      console.warn('⚠️ Firebase Client config contains example placeholders. Using mock Google login for development.');
      idToken = 'mock_google_id_token';
      isMockUsed = true;
    } else {
      if (!auth || !googleProvider) {
        throw new Error('Google Authentication is not configured or failed to initialize.');
      }
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
    return data;
  };

  const registerWithPassword = async (email, password, displayName, bio = null) => {
    const response = await fetch(`${apiBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, bio }),
    });

    const data = await handleResponse(response);
    setAccessToken(data.accessToken);
    setUser(data.user);
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
    return data;
  };

  const updateSecuritySettings = async (password, twoFactorEnabled) => {
    const response = await apiFetch('/api/users/profile/security', {
      method: 'PUT',
      body: JSON.stringify({ password, twoFactorEnabled }),
    });

    const data = await handleResponse(response);
    setUser(data.user);
    return data.user;
  };

  const logoutState = () => {
    setUser(null);
    setAccessToken(null);

    // Clear all client-side storage & caches
    try {
      // Clear sessionStorage
      sessionStorage.clear();

      // Clear localStorage but preserve user's theme preference to avoid visual flashing
      const currentTheme = localStorage.getItem('theme');
      localStorage.clear();
      if (currentTheme) {
        localStorage.setItem('theme', currentTheme);
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
      if (auth) {
        await auth.signOut();
      }
    } catch (firebaseErr) {
      console.error('Error signing out of Firebase SDK:', firebaseErr);
    }

    try {
      await fetch(`${apiBase}/api/auth/logout`, { method: 'POST' });
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
    isAdminPortalOpen,
    setIsAdminPortalOpen,
    requestOtp,
    verifyOtp,
    loginWithGoogle,
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
