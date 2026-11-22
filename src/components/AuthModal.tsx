import React, { useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { BookmarkCheck, History, KeyRound, Layers, X } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { FRAMELEX_LOGO_URL } from '../data/anatomyCatalog';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextHint?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  contextHint,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
      if (message.includes('popup-closed-by-user')) {
        setError('Sign-in popup was closed before completing.');
      } else if (message.includes('popup-blocked')) {
        setError('Browser blocked the sign-in popup. Allow popups for this site and try again.');
      } else {
        setError(message);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs"
    >
      <div className="w-full max-w-md bg-white border border-[#E2DFEE] rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2DFEE] bg-[#F5F3FF]/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={FRAMELEX_LOGO_URL}
              alt="FrameLex logo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover border border-[#E2DFEE] shrink-0"
            />
            <div>
              <h2
                id="auth-modal-title"
                className="font-display text-lg font-bold text-slate-900"
              >
                Sign in to FrameLex
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Optional account sync, history, and personal API key settings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {contextHint && (
            <div className="p-3 bg-[#EEF2FF] border border-[#D8E0FC] rounded-lg text-xs text-indigo-950 leading-relaxed">
              {contextHint}
            </div>
          )}

          <p className="text-sm text-slate-600 leading-relaxed">
            You can always use the Studio directly without an account. Creating or signing into your Google login unlocks persistent cloud storage across sessions:
          </p>

          <ul className="space-y-3 text-xs text-slate-700">
            <li className="flex items-start gap-2.5">
              <BookmarkCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
              <span>
                <strong className="font-semibold text-slate-900">Save &amp; Modify Prompts:</strong>{' '}
                Store full anatomy layers, dialects, and manual or enhanced edits to revisit anytime.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <History className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
              <span>
                <strong className="font-semibold text-slate-900">Generation &amp; Activity Timeline:</strong>{' '}
                Automatically log extractions, enhancements, remixes, and saved revisions.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
              <span>
                <strong className="font-semibold text-slate-900">One-Click Reload into Studio:</strong>{' '}
                Load any past prompt straight into the workbench, tweak layers, and save your updates.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
              <span>
                <strong className="font-semibold text-slate-900">Account-Bounded Personal API Key:</strong>{' '}
                Optionally attach your own Gemini API key exclusively for your signed-in session.
              </span>
            </li>
          </ul>

          {error && (
            <div
              role="alert"
              className="p-3 bg-[#FFF1F2] border border-rose-200 rounded-lg text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={isSigningIn}
              onClick={handleGoogleSignIn}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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
                {isSigningIn ? 'Signing in...' : 'Continue with Google'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-[#F7F6FB] transition-colors"
            >
              Continue using FrameLex as Guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
