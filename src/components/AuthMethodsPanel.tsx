import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  updateProfile,
  type AuthProvider,
} from 'firebase/auth';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Send,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import {
  auth,
  githubProvider,
  googleProvider,
  microsoftProvider,
} from '../firebase';
import {
  EMAIL_LINK_STORAGE_KEY,
  formatFirebaseAuthError,
} from '../utils/authErrors';

export type AuthTab = 'signin' | 'signup' | 'magic';

interface AuthMethodsPanelProps {
  compact?: boolean;
  initialTab?: AuthTab;
  pendingEmailLinkUrl?: string | null;
  onClearPendingEmailLink?: () => void;
  onSuccess?: () => void;
}

export const AuthMethodsPanel: React.FC<AuthMethodsPanelProps> = ({
  compact = false,
  initialTab = 'signin',
  pendingEmailLinkUrl = null,
  onClearPendingEmailLink,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);

  const [confirmLinkEmail, setConfirmLinkEmail] = useState('');

  const resetMessages = () => {
    setError(null);
    setNotice(null);
  };

  const handleOAuthProvider = async (
    provider: AuthProvider,
    providerKey: string,
    providerLabel: string
  ) => {
    setBusyAction(providerKey);
    resetMessages();
    try {
      await signInWithPopup(auth, provider);
      onSuccess?.();
    } catch (err) {
      setError(formatFirebaseAuthError(err, providerLabel));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCompletePendingEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEmailLinkUrl) return;
    const cleanedEmail = confirmLinkEmail.trim();
    if (!cleanedEmail) {
      setError('Enter the email address where you received the sign-in link.');
      return;
    }

    setBusyAction('complete-link');
    resetMessages();
    try {
      await signInWithEmailLink(auth, cleanedEmail, pendingEmailLinkUrl);
      window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
      window.history.replaceState({}, document.title, window.location.pathname);
      onClearPendingEmailLink?.();
      onSuccess?.();
    } catch (err) {
      setError(formatFirebaseAuthError(err, 'Magic Email Link'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedEmail = email.trim();
    if (!cleanedEmail || !password) {
      setError('Enter both your email address and password.');
      return;
    }

    setBusyAction('email-signin');
    resetMessages();
    try {
      await signInWithEmailAndPassword(auth, cleanedEmail, password);
      onSuccess?.();
    } catch (err) {
      setError(formatFirebaseAuthError(err, 'Email & Password Sign-In'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleEasySignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedEmail = email.trim();
    const cleanedName = fullName.trim();
    if (!cleanedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Choose a password with at least 6 characters.');
      return;
    }

    setBusyAction('email-signup');
    resetMessages();
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        cleanedEmail,
        password
      );
      if (cleanedName) {
        await updateProfile(credential.user, {
          displayName: cleanedName.slice(0, 120),
        });
      }
      await sendEmailVerification(credential.user);
      onSuccess?.();
    } catch (err) {
      setError(formatFirebaseAuthError(err, 'Email & Password Sign-Up'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedEmail = email.trim();
    if (!cleanedEmail) {
      setError('Enter your account email to receive a password reset link.');
      return;
    }

    setBusyAction('reset');
    resetMessages();
    try {
      await sendPasswordResetEmail(auth, cleanedEmail);
      setNotice(`Password reset link sent to ${cleanedEmail}. Check your inbox.`);
    } catch (err) {
      setError(formatFirebaseAuthError(err, 'Password Reset'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedEmail = email.trim();
    if (!cleanedEmail) {
      setError('Enter your email address to receive an instant sign-in link.');
      return;
    }

    setBusyAction('magic');
    resetMessages();
    try {
      await sendSignInLinkToEmail(auth, cleanedEmail, {
        url: window.location.origin + window.location.pathname,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, cleanedEmail);
      setMagicLinkSentTo(cleanedEmail);
      setNotice(
        `Instant sign-in link sent to ${cleanedEmail}. Click the link in your email to log in automatically.`
      );
    } catch (err) {
      setError(formatFirebaseAuthError(err, 'Magic Email Link'));
    } finally {
      setBusyAction(null);
    }
  };

  if (pendingEmailLinkUrl) {
    return (
      <form
        onSubmit={handleCompletePendingEmailLink}
        className="p-4 rounded-xl bg-[#EEF2FF]/75 border border-[#D8E0FC] space-y-3"
      >
        <div className="flex items-start gap-2.5">
          <Mail className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-semibold text-slate-900">
              Confirm Email to Complete Magic Link Sign-In
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              You opened your FrameLex sign-in link from a new session. Re-enter your email address to finish logging in.
            </p>
          </div>
        </div>

        <input
          type="email"
          required
          autoComplete="email"
          value={confirmLinkEmail}
          onChange={(e) => setConfirmLinkEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2 text-xs bg-white border border-[#D8E0FC] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
        />

        {error && (
          <div
            role="alert"
            className="p-2.5 bg-[#FFF1F2] border border-rose-200 rounded-lg text-xs text-rose-800"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              onClearPendingEmailLink?.();
            }}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Use another method
          </button>
          <button
            type="submit"
            disabled={busyAction !== null}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <span>
              {busyAction === 'complete-link' ? 'Completing Sign-In...' : 'Complete Sign-In'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {/* 1-Click Social Login & Instant Account Creation */}
      <div className="space-y-2.5">
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => handleOAuthProvider(googleProvider, 'google', 'Google Sign-In')}
          className="w-full px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2.5 shadow-2xs"
        >
          <svg
            className="w-4 h-4 bg-white rounded-full p-0.5 shrink-0"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
            />
            <path
              fill="#34A853"
              d="M3.6 7.3l3.2 2.3C7.7 7.6 9.7 6.2 12 6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5c-3.7 0-6.9 2.1-8.4 4.8z"
            />
            <path
              fill="#FBBC05"
              d="M12 21.5c2.6 0 4.8-.9 6.4-2.4l-3-2.5c-.8.6-1.9 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1l-3.2 2.5c1.5 3.2 4.8 5.5 8.8 5.5z"
            />
            <path
              fill="#4285F4"
              d="M21.1 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.2-1 2.2-2 2.9l3 2.5c1.8-1.7 2.7-4.1 2.7-7.7z"
            />
          </svg>
          <span>
            {busyAction === 'google' ? 'Connecting Google...' : 'Continue with Google'}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => handleOAuthProvider(githubProvider, 'github', 'GitHub Sign-In')}
            className="px-3 py-2 text-xs font-semibold text-slate-800 bg-[#F7F6FB] hover:bg-[#EEF2FF] border border-[#E2DFEE] hover:border-indigo-300 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 fill-slate-900 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.16c-3.2.7-3.87-1.35-3.87-1.35-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.42.36.79 1.06.79 2.15v3.19c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
            <span>{busyAction === 'github' ? 'Connecting...' : 'GitHub'}</span>
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() =>
              handleOAuthProvider(microsoftProvider, 'microsoft', 'Microsoft Sign-In')
            }
            className="px-3 py-2 text-xs font-semibold text-slate-800 bg-[#F7F6FB] hover:bg-[#EEF2FF] border border-[#E2DFEE] hover:border-indigo-300 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 23 23" aria-hidden="true">
              <path fill="#F35325" d="M1 1h10v10H1z" />
              <path fill="#81BC06" d="M12 1h10v10H12z" />
              <path fill="#05A6F0" d="M1 12h10v10H1z" />
              <path fill="#FFBA08" d="M12 12h10v10H12z" />
            </svg>
            <span>{busyAction === 'microsoft' ? 'Connecting...' : 'Microsoft'}</span>
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="relative flex items-center">
        <div className="flex-grow border-t border-[#E2DFEE]" />
        <span className="px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          or with email
        </span>
        <div className="flex-grow border-t border-[#E2DFEE]" />
      </div>

      {/* Mode Switcher: Sign In | Easy Sign Up | Magic Link */}
      <div
        role="tablist"
        aria-label="Email authentication modes"
        className="grid grid-cols-3 p-1 bg-[#F5F3FF] border border-[#E2DFEE] rounded-xl gap-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'signin'}
          onClick={() => {
            setActiveTab('signin');
            setShowForgotPassword(false);
            resetMessages();
          }}
          className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'signin'
              ? 'bg-white text-slate-900 shadow-2xs border border-[#E2DFEE]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-indigo-700" />
          <span>Sign In</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'signup'}
          onClick={() => {
            setActiveTab('signup');
            setShowForgotPassword(false);
            resetMessages();
          }}
          className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'signup'
              ? 'bg-white text-slate-900 shadow-2xs border border-[#E2DFEE]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5 text-indigo-700" />
          <span>Easy Sign Up</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'magic'}
          onClick={() => {
            setActiveTab('magic');
            setShowForgotPassword(false);
            resetMessages();
          }}
          className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${
            activeTab === 'magic'
              ? 'bg-white text-slate-900 shadow-2xs border border-[#E2DFEE]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
          <span>Magic Link</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {notice && (
        <div
          role="status"
          className="p-3 bg-[#ECFDF5] border border-[#CDEEE0] rounded-xl text-xs text-emerald-900 flex items-start gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-3 bg-[#FFF1F2] border border-rose-200 rounded-xl text-xs text-rose-800 leading-relaxed"
        >
          {error}
        </div>
      )}

      {/* Email + Password Sign In / Forgot Password */}
      {activeTab === 'signin' && !showForgotPassword && (
        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <div>
            <label
              htmlFor={compact ? 'modal-signin-email' : 'gate-signin-email'}
              className="block text-[11px] font-semibold text-slate-700 mb-1"
            >
              Email Address
            </label>
            <input
              id={compact ? 'modal-signin-email' : 'gate-signin-email'}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="creator@example.com"
              className="w-full px-3 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor={compact ? 'modal-signin-password' : 'gate-signin-password'}
                className="block text-[11px] font-semibold text-slate-700"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  resetMessages();
                }}
                className="text-[11px] font-medium text-indigo-700 hover:text-indigo-900"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id={compact ? 'modal-signin-password' : 'gate-signin-password'}
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-3 pr-9 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busyAction !== null}
            className="w-full px-4 py-2.5 text-xs font-semibold text-indigo-950 bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#D8E0FC] disabled:opacity-50 rounded-xl transition-colors"
          >
            {busyAction === 'email-signin' ? 'Signing In...' : 'Sign In with Email'}
          </button>
        </form>
      )}

      {/* Password Reset Form */}
      {activeTab === 'signin' && showForgotPassword && (
        <form onSubmit={handleSendPasswordReset} className="space-y-3">
          <div>
            <label
              htmlFor={compact ? 'modal-reset-email' : 'gate-reset-email'}
              className="block text-[11px] font-semibold text-slate-700 mb-1"
            >
              Account Email Address
            </label>
            <input
              id={compact ? 'modal-reset-email' : 'gate-reset-email'}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="creator@example.com"
              className="w-full px-3 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                resetMessages();
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Back to Sign In
            </button>
            <button
              type="submit"
              disabled={busyAction !== null}
              className="px-4 py-2 text-xs font-semibold text-indigo-950 bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#D8E0FC] disabled:opacity-50 rounded-xl transition-colors"
            >
              {busyAction === 'reset' ? 'Sending Reset Link...' : 'Send Reset Link'}
            </button>
          </div>
        </form>
      )}

      {/* Easy 1-Step Sign Up */}
      {activeTab === 'signup' && (
        <form onSubmit={handleEasySignUp} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor={compact ? 'modal-signup-name' : 'gate-signup-name'}
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Your Name <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id={compact ? 'modal-signup-name' : 'gate-signup-name'}
                type="text"
                maxLength={120}
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full px-3 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
              />
            </div>

            <div>
              <label
                htmlFor={compact ? 'modal-signup-email' : 'gate-signup-email'}
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Email Address
              </label>
              <input
                id={compact ? 'modal-signup-email' : 'gate-signup-email'}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@studio.com"
                className="w-full px-3 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor={compact ? 'modal-signup-password' : 'gate-signup-password'}
                className="block text-[11px] font-semibold text-slate-700"
              >
                Create Password
              </label>
              <span
                className={`text-[11px] font-medium ${
                  password.length >= 6 ? 'text-emerald-700' : 'text-slate-400'
                }`}
              >
                {password.length >= 6 ? 'Ready (6+ chars)' : 'Minimum 6 characters'}
              </span>
            </div>
            <div className="relative">
              <input
                id={compact ? 'modal-signup-password' : 'gate-signup-password'}
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                className="w-full pl-3 pr-9 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busyAction !== null}
            className="w-full px-4 py-2.5 text-xs font-semibold text-indigo-950 bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#D8E0FC] disabled:opacity-50 rounded-xl transition-colors"
          >
            {busyAction === 'email-signup' ? 'Creating Account...' : 'Create Free FrameLex Account'}
          </button>
        </form>
      )}

      {/* Passwordless Magic Email Link */}
      {activeTab === 'magic' && (
        <form onSubmit={handleSendMagicLink} className="space-y-3">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            No password needed—enter your email to receive a one-click sign-in &amp; instant signup link.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="creator@example.com"
              aria-label="Email address for magic sign-in link"
              className="flex-1 px-3 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
            />
            <button
              type="submit"
              disabled={busyAction !== null}
              className="px-4 py-2 text-xs font-semibold text-indigo-950 bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#D8E0FC] disabled:opacity-50 rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5 text-indigo-700" />
              <span>
                {busyAction === 'magic'
                  ? 'Sending...'
                  : magicLinkSentTo
                    ? 'Resend Link'
                    : 'Send Magic Link'}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
