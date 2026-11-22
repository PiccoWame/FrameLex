import React, { useState } from 'react';
import { sendEmailVerification, type User } from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  MailCheck,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { FRAMELEX_LOGO_URL } from '../data/anatomyCatalog';
import { saveUserApiKeyConfig } from '../services/firestoreService';
import { formatFirebaseAuthError } from '../utils/authErrors';
import { AuthMethodsPanel } from './AuthMethodsPanel';

interface AccessGateProps {
  mode: 'signin' | 'verify' | 'apikey';
  user: User | null;
  redirectHint?: string | null;
  pendingEmailLinkUrl?: string | null;
  onClearPendingEmailLink?: () => void;
  onBackToStudio?: () => void;
  onRefreshVerification?: () => Promise<boolean>;
  onSignOut?: () => void;
}

export const AccessGate: React.FC<AccessGateProps> = ({
  mode,
  user,
  redirectHint = null,
  pendingEmailLinkUrl = null,
  onClearPendingEmailLink,
  onBackToStudio,
  onRefreshVerification,
  onSignOut,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keyLabelInput, setKeyLabelInput] = useState('Personal Gemini Key');
  const [showKey, setShowKey] = useState(false);
  const [isSubmittingKey, setIsSubmittingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [isCheckingVerify, setIsCheckingVerify] = useState(false);
  const [isResendingVerify, setIsResendingVerify] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleVerifyAndSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setKeyError(null);

    const trimmedKey = apiKeyInput.trim();
    if (trimmedKey.length < 20 || /\s/.test(trimmedKey)) {
      setKeyError(
        'Enter a valid Gemini API key (at least 20 characters with no spaces).'
      );
      return;
    }

    setIsSubmittingKey(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/verify-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-user-gemini-key': trimmedKey,
        },
        body: JSON.stringify({}),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(
          payload?.error || 'Could not verify your Gemini API key.'
        );
      }

      await saveUserApiKeyConfig(user, {
        geminiApiKey: trimmedKey,
        usePersonalKey: true,
        label: keyLabelInput.trim() || 'Personal Gemini Key',
      });
      setApiKeyInput('');
    } catch (err) {
      setKeyError(
        err instanceof Error
          ? err.message
          : 'Unable to verify and bind your Gemini API key.'
      );
    } finally {
      setIsSubmittingKey(false);
    }
  };

  const handleCheckVerified = async () => {
    if (!onRefreshVerification) return;
    setVerifyNotice(null);
    setVerifyError(null);
    setIsCheckingVerify(true);
    try {
      const verified = await onRefreshVerification();
      if (!verified) {
        setVerifyError(
          'Your email is not marked verified yet. Click the verification link in your inbox (or spam folder), then press Check Verification again.'
        );
      }
    } catch (err) {
      setVerifyError(formatFirebaseAuthError(err, 'Email Verification'));
    } finally {
      setIsCheckingVerify(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    setVerifyNotice(null);
    setVerifyError(null);
    setIsResendingVerify(true);
    try {
      await sendEmailVerification(user);
      setVerifyNotice(
        `Verification link sent to ${user.email || 'your email'}. Open the link in your inbox, then click "I've Verified — Continue".`
      );
    } catch (err) {
      setVerifyError(formatFirebaseAuthError(err, 'Verification Email'));
    } finally {
      setIsResendingVerify(false);
    }
  };

  if (mode === 'signin') {
    return (
      <div className="max-w-5xl mx-auto py-6 sm:py-10 space-y-4">
        {onBackToStudio && !pendingEmailLinkUrl && (
          <div>
            <button
              type="button"
              onClick={onBackToStudio}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-indigo-300 hover:text-indigo-900 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Studio</span>
            </button>
          </div>
        )}

        <div className="bg-white border border-[#E2DFEE] rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-7 p-6 sm:p-8 space-y-5">
            {redirectHint && (
              <div className="p-3 bg-[#EEF2FF] border border-[#D8E0FC] rounded-xl text-xs text-indigo-950 leading-relaxed">
                {redirectHint}
              </div>
            )}

            <div className="flex items-center gap-3">
              <img
                src={FRAMELEX_LOGO_URL}
                alt="FrameLex logo"
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-xl object-cover border border-[#D8D3EB] bg-white shrink-0"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
                  FrameLex · Visual Prompt Workbench
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Sign in or create your account
                </h1>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Use Google, GitHub, Microsoft, a passwordless Magic Link, or fast Email &amp; Password signup—then connect your personal Gemini API key to unlock FrameLex.
            </p>

            <AuthMethodsPanel
              pendingEmailLinkUrl={pendingEmailLinkUrl}
              onClearPendingEmailLink={onClearPendingEmailLink}
            />
          </div>

          <div className="lg:col-span-5 bg-[#F5F3FF]/75 border-t lg:border-t-0 lg:border-l border-[#E2DFEE] p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                <div className="p-3.5 rounded-xl bg-[#EEF2FF]/85 border border-[#D8E0FC] space-y-1">
                  <div className="text-xs font-semibold text-indigo-950 flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-indigo-700">01</span>
                    <span>Flexible Login &amp; Easy Sign-Up</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Sign in with 1-click social accounts, a passwordless inbox Magic Link, or create an account in seconds.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FFF4ED]/85 border border-[#F5DFD0] space-y-1">
                  <div className="text-xs font-semibold text-amber-950 flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-amber-800">02</span>
                    <span>Bind Your Personal API Key</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Enter your own Gemini key—strictly isolated to your login and never shared with anyone else.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-950">
                  <Lock className="w-4 h-4 text-indigo-700" />
                  <span>Private &amp; Isolated by Account</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-semibold text-slate-900">No Shared API Key:</strong>{' '}
                      Every AI analysis, enhancement, and stylistic variation runs strictly on your own Gemini key.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <KeyRound className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-semibold text-slate-900">Account-Bound Storage:</strong>{' '}
                      Your key is stored in a private vault restricted exclusively to your authenticated UID.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-violet-700 shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-semibold text-slate-900">Link Multiple Logins:</strong>{' '}
                      Add backup login methods anytime in Account Settings to access the same prompts and key.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2DFEE] text-[11px] text-slate-600 leading-relaxed">
              Need a personal Gemini API key? You can create one for free in Google AI Studio right after signing in.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'verify') {
    return (
      <div className="max-w-xl mx-auto py-8 sm:py-12">
        <div className="bg-white border border-[#E2DFEE] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-[#EEF2FF]/75 border-b border-[#E2DFEE] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={FRAMELEX_LOGO_URL}
                alt="FrameLex logo"
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-lg object-cover border border-[#D8D3EB] bg-white shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
                  Account Activation
                </p>
                <h1 className="font-display text-lg font-bold text-slate-900 truncate">
                  Verify your email to continue
                </h1>
              </div>
            </div>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-slate-300 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch Account</span>
              </button>
            )}
          </div>

          <div className="p-6 sm:p-7 space-y-5">
            <div className="p-4 rounded-xl bg-[#F5F3FF]/80 border border-[#E2D9FA] flex items-start gap-3">
              <MailCheck className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                <p>
                  We sent a verification email to{' '}
                  <strong className="font-semibold text-slate-900">
                    {user?.email || 'your account email'}
                  </strong>
                  .
                </p>
                <p>
                  Confirming ownership protects your private Gemini API key vault and saved prompts. Click the link in your inbox, then press the button below.
                </p>
              </div>
            </div>

            {verifyNotice && (
              <div
                role="status"
                className="p-3 bg-[#ECFDF5] border border-[#CDEEE0] rounded-xl text-xs text-emerald-900"
              >
                {verifyNotice}
              </div>
            )}

            {verifyError && (
              <div
                role="alert"
                className="p-3 bg-[#FFF1F2] border border-rose-200 rounded-xl text-xs text-rose-800"
              >
                {verifyError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={isResendingVerify}
                onClick={handleResendVerification}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-indigo-300 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-indigo-700" />
                <span>
                  {isResendingVerify ? 'Sending...' : 'Resend Verification Email'}
                </span>
              </button>

              <button
                type="button"
                disabled={isCheckingVerify}
                onClick={handleCheckVerified}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isCheckingVerify ? 'animate-spin' : ''}`}
                />
                <span>
                  {isCheckingVerify ? 'Checking Status...' : "I've Verified — Continue"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Verified & signed in, waiting for user to bind their personal Gemini API key
  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-10">
      <div className="bg-white border border-[#E2DFEE] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-[#EEF2FF]/70 border-b border-[#E2DFEE] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={FRAMELEX_LOGO_URL}
              alt="FrameLex logo"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-[#D8D3EB] bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="truncate">
                  Signed in as {user?.displayName || user?.email}
                </span>
              </div>
              <h1 className="font-display text-lg font-bold text-slate-900">
                Enter Your Personal Gemini API Key
              </h1>
            </div>
          </div>

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-slate-300 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch Account</span>
            </button>
          )}
        </div>

        <form onSubmit={handleVerifyAndSaveKey} className="p-6 sm:p-7 space-y-5">
          <div className="p-3.5 rounded-xl bg-[#F5F3FF]/75 border border-[#E2D9FA] text-xs text-slate-700 leading-relaxed">
            <strong className="font-semibold text-slate-900">
              Step 2 of 2 · Exclusive Account Binding:
            </strong>{' '}
            Your API key is verified against your authenticated session, stored privately under your own account (
            <span className="font-mono text-[11px]">{user?.email}</span>), and is never shared with other users.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label
                htmlFor="gate-personal-gemini-key"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Personal Gemini API Key
              </label>
              <div className="relative">
                <input
                  id="gate-personal-gemini-key"
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIza..."
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs font-mono bg-[#F7F6FB] border border-[#E2DFEE] rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-700"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="gate-personal-key-label"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Key Label
              </label>
              <input
                id="gate-personal-key-label"
                type="text"
                maxLength={80}
                value={keyLabelInput}
                onChange={(e) => setKeyLabelInput(e.target.value)}
                placeholder="My Studio Key"
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#E2DFEE] rounded-xl text-slate-900 focus:outline-none focus:border-indigo-700"
              />
            </div>
          </div>

          {keyError && (
            <div
              role="alert"
              className="p-3 bg-[#FFF1F2] border border-rose-200 rounded-xl text-xs text-rose-800"
            >
              {keyError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-indigo-800 hover:text-indigo-950 inline-flex items-center gap-1"
            >
              <span>Get a Gemini API key in Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="submit"
              disabled={isSubmittingKey || !apiKeyInput.trim()}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {isSubmittingKey ? 'Verifying & Binding Key...' : 'Verify & Unlock FrameLex'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
