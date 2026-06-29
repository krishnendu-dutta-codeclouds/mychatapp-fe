import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, KeyRound, ArrowRight, Sparkles, User, FileText } from 'lucide-react';

function AuthScreen() {
  const {
    requestOtp,
    verifyOtp,
    loginWithGoogle,
    loginWithPassword,
    registerWithPassword,
    verify2fa
  } = useAuth();

  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [loginType, setLoginType] = useState('otp'); // 'otp' | 'password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Credentials, 2: OTP/2FA Verification
  const [is2faFlow, setIs2faFlow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!email) return;

    setError('');
    setLoading(true);

    try {
      if (authMode === 'register') {
        if (!displayName.trim()) {
          setError('Please enter your display name.');
          setLoading(false);
          return;
        }
        if (!password) {
          setError('Please enter a password.');
          setLoading(false);
          return;
        }
        // Send OTP code first
        await requestOtp(email, 'register');
        setIs2faFlow(false);
        setStep(2);
      } else {
        // Login mode
        if (loginType === 'password') {
          if (!password) {
            setError('Please enter your password.');
            setLoading(false);
            return;
          }
          const data = await loginWithPassword(email, password);
          if (data && data.status === '2fa_required') {
            setIs2faFlow(true);
            setStep(2);
          }
        } else {
          // OTP login mode
          const data = await requestOtp(email, 'login');
          if (data.status !== 'admin_auto_login') {
            setIs2faFlow(false);
            setStep(2);
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    setError('');
    try {
      if (is2faFlow) {
        await verify2fa(email, otp);
      } else {
        if (authMode === 'register') {
          await registerWithPassword(email, password, displayName.trim(), bio.trim() || 'Hey there! I am using Talkzen.', otp);
        } else {
          await verifyOtp(email, otp);
        }
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setError('');
    setAuthMode(prev => prev === 'login' ? 'register' : 'login');
    // Clear fields when switching modes
    setDisplayName('');
    setBio('');
    setPassword('');
    setOtp('');
    setStep(1);
    setIs2faFlow(false);
  };

  return (
    <div className="relative w-full max-w-md p-8 rounded-3xl glass shadow-2xl border border-zinc-800/80 mx-4 overflow-hidden">
      {/* Dynamic Back-Glow Ring */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo/Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="h-16 w-16 bg-gradient-to-tr from-emerald-500 to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25 mb-6"
        >
          <Sparkles className="h-8 w-8 text-zinc-950" />
        </motion.div>

        <h2 className="text-2xl font-bold tracking-tight text-white font-sans text-center">
          {step === 2
            ? is2faFlow
              ? 'Two-Factor Verification'
              : 'Confirm your Identity'
            : authMode === 'login'
              ? 'Welcome to Talkzen'
              : 'Create an Account'
          }
        </h2>
        <p className="mt-2 text-sm text-zinc-400 text-center max-w-[280px]">
          {step === 2
            ? `We've sent a 6-digit code to ${email}.`
            : authMode === 'login'
              ? 'Sign in using verification code or password credentials.'
              : 'Enroll your details to register and open a secure mailbox.'
          }
        </p>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 text-center font-medium"
          >
            {error}
          </motion.div>
        )}

        <div className="w-full mt-6">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key={authMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmitForm}
                className="space-y-4"
              >
                {/* Mode Selector Tabs for Login */}
                {authMode === 'login' && (
                  <div className="flex bg-zinc-950/40 p-1 rounded-xl border border-zinc-800/50 mb-4">
                    <button
                      type="button"
                      onClick={() => { setLoginType('otp'); setError(''); }}
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition duration-200 ${loginType === 'otp' ? 'bg-emerald-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'}`}
                    >
                      OTP Code
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLoginType('password'); setError(''); }}
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition duration-200 ${loginType === 'password' ? 'bg-emerald-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'}`}
                    >
                      Password
                    </button>
                  </div>
                )}

                {/* Email Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="block w-full pl-11 pr-4 py-3.5 bg-zinc-900 border border-zinc-800/80 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 font-sans"
                  />
                </div>

                {/* Password Input (Login Password Mode or Registration Mode) */}
                {((authMode === 'login' && loginType === 'password') || authMode === 'register') && (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter Password"
                      className="block w-full pl-11 pr-4 py-3.5 bg-zinc-900 border border-zinc-800/80 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 font-sans"
                    />
                  </div>
                )}

                {/* Registration Specific Fields */}
                {authMode === 'register' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* Display Name Input */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                        <User className="h-5 w-5" />
                      </div>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Choose Display Name"
                        className="block w-full pl-11 pr-4 py-3.5 bg-zinc-900 border border-zinc-800/80 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 font-sans"
                      />
                    </div>

                    {/* Bio Input */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                        <FileText className="h-5 w-5" />
                      </div>
                      <input
                        type="text"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Status / Bio (Optional)"
                        className="block w-full pl-11 pr-4 py-3.5 bg-zinc-900 border border-zinc-800/80 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300 font-sans"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-white text-zinc-950 font-semibold rounded-2xl shadow-lg hover:bg-zinc-200 transition duration-300 flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin"></div>
                  ) : (
                    <>
                      {authMode === 'login'
                        ? loginType === 'password' ? 'Sign In' : 'Request Verification'
                        : 'Register Account'
                      }
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Mode toggle link */}
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={toggleAuthMode}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition duration-200"
                  >
                    {authMode === 'login'
                      ? "Don't have an account? Register here"
                      : "Already have an account? Sign in here"
                    }
                  </button>
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-zinc-800/40"></div>
                  <span className="flex-shrink mx-4 text-[9px] text-zinc-500 font-bold uppercase tracking-wider">or</span>
                  <div className="flex-grow border-t border-zinc-800/40"></div>
                </div>

                {/* Google Login (Automatic Login/Signup) */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800/80 rounded-2xl shadow-lg text-zinc-200 hover:text-white font-semibold transition duration-300 flex items-center justify-center gap-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
                >
                  <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.74 14.93 1 12 1 7.37 1 3.4 3.67 1.39 7.56l3.86 3C6.18 7.37 8.85 5.04 12 5.04z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.48-5.02 3.48-8.64z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.25 14.18c-.25-.72-.39-1.5-.39-2.31s.14-1.59.39-2.31L1.39 7.56C.5 9.36 0 11.37 0 13.5s.5 4.14 1.39 5.94l3.86-3.26z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.05.7-2.39 1.12-4.2 1.12-3.15 0-5.82-2.33-6.77-5.52l-3.86 3C3.4 20.33 7.37 23 12 23z"
                    />
                  </svg>
                  {authMode === 'login' ? 'Sign in with Google' : 'Register with Google'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="otp-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOtp}
                className="space-y-4"
              >
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]*"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="block w-full pl-11 pr-4 py-3.5 bg-zinc-900 border border-zinc-800/80 rounded-2xl text-white tracking-[0.25em] text-center font-bold placeholder-zinc-500 placeholder:tracking-normal text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all duration-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-emerald-500 text-zinc-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/10 hover:bg-emerald-400 transition duration-300 flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Verify and Continue <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setOtp('');
                      setError('');
                    }}
                    className="text-xs text-zinc-400 hover:text-white transition duration-200"
                  >
                    ← Back to Entry
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default AuthScreen;
