/**
 * Resolves the backend API and Socket URL dynamically.
 * - If VITE_API_URL is set (in local .env or Vercel dashboard), it takes precedence.
 * - In local development (localhost/127.0.0.1), it returns an empty string to leverage the Vite proxy.
 * - In production deployments (e.g. Vercel), it defaults to the live Render backend URL.
 */
export const getApiUrl = () => {
  // 1. Check if VITE_API_URL is explicitly defined
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }

  // 2. Local development check
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      return '';
    }
  }

  // 3. Deployed production fallback
  return 'https://mychatapp-be-z1nx.onrender.com';
};

export const API_BASE_URL = getApiUrl();
