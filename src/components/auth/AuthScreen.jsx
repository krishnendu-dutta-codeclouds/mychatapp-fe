import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  KeyRound,
  ArrowRight,
  Sparkles,
  User,
  FileText,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';

const OTP_LENGTH = 6;

function AuthScreen() {
  const {
    requestOtp,
    verifyOtp,
    loginWithGoogle,
    loginWithPassword,
    registerWithPassword,
    verify2fa,
  } = useAuth();

  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [loginType, setLoginType] = useState('password'); // 'otp' | 'password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [otpValue, setOtpValue] = useState('');
  const [step, setStep] = useState(1); // 1: Credentials, 2: OTP/2FA Verification
  const [is2faFlow, setIs2faFlow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const otpRefs = useRef([]);

  // Keep derived otpValue when digits change
  useEffect(() => {
    setOtpValue(otpDigits.join(''));
  }, [otpDigits]);

  // Trigger shake on error
  useEffect(() => {
    if (error) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 450);
      return () => clearTimeout(t);
    }
  }, [error]);

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
    if (otpValue.length !== OTP_LENGTH) return;

    setLoading(true);
    setError('');
    try {
      if (is2faFlow) {
        await verify2fa(email, otpValue);
      } else {
        if (authMode === 'register') {
          await registerWithPassword(
            email,
            password,
            displayName.trim(),
            bio.trim() || 'Hey there! I am using Talkzen.',
            otpValue
          );
        } else {
          await verifyOtp(email, otpValue);
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
    setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'));
    // Clear fields when switching modes
    setDisplayName('');
    setBio('');
    setPassword('');
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setOtpValue('');
    setShowPassword(false);
    setStep(1);
    setIs2faFlow(false);
  };

  // OTP input handlers (auto-advance, backspace focus)
  const handleOtpChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otpDigits];
    next[idx] = val;
    setOtpDigits(next);
    if (val && idx < OTP_LENGTH - 1) {
      otpRefs.current[idx + 1]?.focus();
      otpRefs.current[idx + 1]?.select?.();
    }
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = (e.clipboardData.getData('text') || '')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    otpRefs.current[focusIdx]?.focus();
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-start p-4 sm:p-8 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      {/* Animated Aurora Mesh Background */}
      <div className="auth-aurora" aria-hidden="true">
        <div className="blob blob-b" />
      </div>

      {/* Vignette overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
        }}
      />

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="auth-card relative z-10 w-full max-w-[min(420px,100%)] sm:max-w-md my-auto p-6 sm:p-8"
      >
        <div className="relative z-10 flex flex-col items-center">
          {/* Logo with animated glow */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, delay: 0.05 }}
            className="relative mb-5 sm:mb-6"
          >
            <div className="auth-logo-glow" aria-hidden="true" />
            <div className="relative h-14 w-14 sm:h-16 sm:w-16 bg-gradient-to-tr from-emerald-500 via-emerald-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30">
              {step === 2 ? (
                is2faFlow ? (
                  <ShieldCheck className="h-7 w-7 sm:h-8 sm:w-8 text-white drop-shadow" />
                ) : (
                  <KeyRound className="h-7 w-7 sm:h-8 sm:w-8 text-white drop-shadow" />
                )
              ) : (
                <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-white drop-shadow" />
              )}
            </div>
          </motion.div>

          {/* Headline + Subtitle */}
          <motion.h2
            key={step + authMode + is2faFlow + 'h'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white text-center"
          >
            {step === 2
              ? is2faFlow
                ? 'Two-Factor Verification'
                : 'Confirm your Identity'
              : authMode === 'login'
              ? 'Welcome to Talkzen'
              : 'Create an Account'}
          </motion.h2>

          <motion.p
            key={step + authMode + is2faFlow + 'p'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="mt-1.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-[320px] px-2"
          >
            {step === 2
              ? `We sent a 6-digit code to ${email || 'your email'}.`
              : authMode === 'login'
              ? 'Sign in with a verification code or your password.'
              : 'Enroll your details to register a secure mailbox.'}
          </motion.p>

          {/* Back to step 1 link (only on step 2) */}
          {step === 2 && (
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtpDigits(Array(OTP_LENGTH).fill(''));
                setOtpValue('');
                setError('');
              }}
              className="mt-3 inline-flex items-center gap-1 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
            >
              <ArrowLeft className="h-3 w-3" /> Back to {authMode === 'login' ? 'login' : 'register'}
            </button>
          )}

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                className="w-full mt-4 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-600 dark:text-red-300 text-center font-medium"
                role="alert"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forms */}
          <div className="w-full mt-6 sm:mt-7">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form
                  key={authMode + loginType + '-step1'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22 }}
                  onSubmit={handleSubmitForm}
                  className={`space-y-3.5 ${shake ? 'input-shake' : ''}`}
                  noValidate
                >

                  {/* Email */}
                  <Field id="email" label="Email address" icon={<Mail className="h-4 w-4" />}>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="block w-full pl-1 pr-3 py-3 sm:py-3.5 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-sm focus:outline-none focus:ring-0 border-0 font-sans"
                    />
                  </Field>

                  {/* Password */}
                  {(authMode === 'register' ||
                    (authMode === 'login' && loginType === 'password')) && (
                    <Field
                      id="password"
                      label="Password"
                      icon={<Lock className="h-4 w-4" />}
                      right={
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition p-1 -mr-1"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    >
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          authMode === 'register'
                            ? 'Create a strong password'
                            : 'Enter your password'
                        }
                        className="block w-full pl-1 pr-10 py-3 sm:py-3.5 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-sm focus:outline-none focus:ring-0 border-0 font-sans"
                      />
                    </Field>
                  )}

                  {/* Registration-only fields */}
                  <AnimatePresence initial={false}>
                    {authMode === 'register' && (
                      <motion.div
                        key="register-extras"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-3.5 overflow-hidden"
                      >
                        <Field id="displayName" label="Display name" icon={<User className="h-4 w-4" />}>
                          <input
                            id="displayName"
                            type="text"
                            required
                            autoComplete="name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your display name"
                            className="block w-full pl-1 pr-3 py-3 sm:py-3.5 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-sm focus:outline-none focus:ring-0 border-0 font-sans"
                          />
                        </Field>

                        <Field id="bio" label="Status / Bio (optional)" icon={<FileText className="h-4 w-4" />}>
                          <input
                            id="bio"
                            type="text"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Hey there! I am using Talkzen."
                            className="block w-full pl-1 pr-3 py-3 sm:py-3.5 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-sm focus:outline-none focus:ring-0 border-0 font-sans"
                          />
                        </Field>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Primary submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="relative w-full py-3.5 px-4 rounded-2xl font-semibold text-sm
                               text-white bg-gradient-to-r from-emerald-500 via-emerald-500 to-indigo-500
                               shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40
                               hover:brightness-110 active:scale-[0.99]
                               transition-all duration-300 flex items-center justify-center gap-2
                               focus:outline-none focus:ring-2 focus:ring-offset-2
                               focus:ring-emerald-400 focus:ring-offset-white
                               dark:focus:ring-offset-zinc-950
                               disabled:opacity-70 disabled:cursor-not-allowed
                               min-h-[44px]"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        <span>Please wait…</span>
                      </span>
                    ) : (
                      <>
                        <span>
                          {authMode === 'login'
                            ? loginType === 'password'
                              ? 'Sign In'
                              : 'Send Verification Code'
                            : 'Create Account'}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {/* Mode toggle */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={toggleAuthMode}
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition"
                    >
                      {authMode === 'login'
                        ? "Don't have an account? Register"
                        : 'Already have an account? Sign in'}
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="relative flex py-2 items-center" role="separator">
                    <div className="flex-grow border-t border-zinc-300/70 dark:border-zinc-800/70" />
                    <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      or continue with
                    </span>
                    <div className="flex-grow border-t border-zinc-300/70 dark:border-zinc-800/70" />
                  </div>

                  {/* Google */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-3 sm:py-3.5 px-4 rounded-2xl font-semibold text-sm
                               bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200
                               border border-zinc-300/70 dark:border-zinc-800/80
                               hover:bg-zinc-100 dark:hover:bg-zinc-800
                               transition-all duration-200 flex items-center justify-center gap-2.5
                               focus:outline-none focus:ring-2 focus:ring-zinc-400
                               min-h-[44px] disabled:opacity-70"
                  >
                    <GoogleIcon />
                    {authMode === 'login'
                      ? 'Continue with Google'
                      : 'Sign up with Google'}
                  </button>
                </motion.form>
              ) : (
                /* OTP / 2FA step */
                <motion.form
                  key="otp-step2"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                  onSubmit={handleVerifyOtp}
                  className={`space-y-5 ${shake ? 'input-shake' : ''}`}
                >
                  <div
                    className="flex justify-between gap-1.5 sm:gap-2 max-w-xs mx-auto"
                    onPaste={handleOtpPaste}
                  >
                    {otpDigits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => (otpRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        value={d}
                        onChange={(e) => handleOtpChange(i, e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        onFocus={(e) => e.target.select()}
                        aria-label={`Digit ${i + 1}`}
                        className={`otp-cell w-full aspect-square min-w-0 max-w-[52px] text-center text-lg sm:text-xl font-bold
                                    rounded-xl border-2 outline-none transition-all duration-200
                                    bg-white/90 dark:bg-zinc-900/80
                                    ${
                                      d
                                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/20'
                                        : 'border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                                    }
                                    focus:border-emerald-500 focus:shadow-md focus:shadow-emerald-500/20`}
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpValue.length !== OTP_LENGTH}
                    className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm
                               text-white bg-gradient-to-r from-emerald-500 to-indigo-500
                               shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40
                               hover:brightness-110 active:scale-[0.99]
                               transition-all duration-300 flex items-center justify-center gap-2
                               focus:outline-none focus:ring-2 focus:ring-offset-2
                               focus:ring-emerald-400 focus:ring-offset-white
                               dark:focus:ring-offset-zinc-950
                               disabled:opacity-60 disabled:cursor-not-allowed
                               min-h-[44px]"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        <span>Verifying…</span>
                      </span>
                    ) : (
                      <>
                        Verify & Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {/* Resend */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setError('');
                        setLoading(true);
                        try {
                          await requestOtp(email, authMode === 'register' ? 'register' : 'login');
                        } catch (err) {
                          setError(err.message || 'Could not resend code.');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                    >
                      Didn’t get a code? Resend
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Tiny footer terms */}
          <p className="mt-6 sm:mt-7 text-[10px] sm:text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 text-center max-w-[300px]">
            By continuing, you agree to Talkzen’s{' '}
            <span className="text-zinc-600 dark:text-zinc-300 underline-offset-2 hover:underline cursor-pointer">
              Terms
            </span>{' '}
            &{' '}
            <span className="text-zinc-600 dark:text-zinc-300 underline-offset-2 hover:underline cursor-pointer">
              Privacy Policy
            </span>
            .
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* Field wrapper — provides icon, label, optional right slot, and clean focus state */
function Field({ id, label, icon, right, children }) {
  return (
    <div className="group">
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1"
      >
        {label}
      </label>
      <div
        className="relative flex items-center rounded-2xl border border-zinc-300/70 dark:border-zinc-800/80
                   bg-white/90 dark:bg-zinc-900/80 backdrop-blur
                   transition-all duration-200
                   focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20
                   hover:border-zinc-400 dark:hover:border-zinc-700"
      >
        <span className="pl-3.5 pr-2 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition">
          {icon}
        </span>
        <div className="flex-1 min-w-0">{children}</div>
        {right && <div className="pr-2">{right}</div>}
      </div>
    </div>
  );
}

/* Inline Google G logo (multi-color, like Google's brand) */
function GoogleIcon() {
  return (
    <svg
      className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
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
  );
}

export default AuthScreen;
