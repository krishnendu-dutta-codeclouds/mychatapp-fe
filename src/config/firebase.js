import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase Client Config from environment variables (prefixed with VITE_ in Vite)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Check if Firebase config has real (non-placeholder) values before initializing
const hasValidConfig = firebaseConfig.apiKey && 
                       !firebaseConfig.apiKey.includes('example') &&
                       firebaseConfig.projectId &&
                       !firebaseConfig.projectId.includes('example') &&
                       !firebaseConfig.projectId.includes('your-firebase');

let auth = null;
let googleProvider = null;

if (hasValidConfig) {
  try {
    // Initialize Firebase only when real credentials are present
    const app = initializeApp(firebaseConfig);

    // Initialize Firebase Authentication
    auth = getAuth(app);

    // Initialize Google Auth Provider
    googleProvider = new GoogleAuthProvider();

    // Configure Google provider to request email and profile
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
  } catch (err) {
    console.warn('⚠️ Firebase initialization failed:', err.message);
    auth = null;
    googleProvider = null;
  }
} else {
  console.warn('⚠️ Firebase Client SDK not initialized: Missing or placeholder configuration values.');
  console.warn('Google Sign-In will use mock mode in development. Set real VITE_FIREBASE_* env vars for production.');
}

export { auth, googleProvider, hasValidConfig };
