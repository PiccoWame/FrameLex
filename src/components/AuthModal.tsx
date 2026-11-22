import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { FRAMELEX_LOGO_URL } from '../data/anatomyCatalog';
import { AuthMethodsPanel } from './AuthMethodsPanel';

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
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-md bg-white border border-[#E2DFEE] rounded-2xl shadow-xl overflow-hidden my-auto">
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
                Sign in or Sign up
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Access your FrameLex account, personal API key, and prompt library
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

        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {contextHint && (
            <div className="p-3 bg-[#EEF2FF] border border-[#D8E0FC] rounded-lg text-xs text-indigo-950 leading-relaxed">
              {contextHint}
            </div>
          )}

          <AuthMethodsPanel compact onSuccess={onClose} />
        </div>
      </div>
    </div>
  );
};
