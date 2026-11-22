import React, { useEffect } from 'react';
import { Keyboard, Layers, Lock, Sparkles, X } from 'lucide-react';
import { ANATOMY_LAYER_INDEX, FRAMELEX_LOGO_URL } from '../data/anatomyCatalog';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: 'Ctrl / Cmd + V', action: 'Paste an image directly from clipboard anywhere in the Studio' },
  { keys: 'Ctrl / Cmd + Enter', action: 'Extract or re-analyze the active reference image' },
  { keys: 'Esc', action: 'Close open dialogs or image lightbox previews' },
];

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
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
      aria-labelledby="about-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-white border border-[#E2DFEE] rounded-2xl shadow-xl overflow-hidden my-auto">
        <div className="px-6 py-5 bg-[#EEF2FF]/70 border-b border-[#E2DFEE] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={FRAMELEX_LOGO_URL}
              alt="FrameLex logo"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl object-cover border border-[#D8D3EB] bg-white shrink-0"
            />
            <div className="min-w-0">
              <h2
                id="about-modal-title"
                className="font-display text-lg font-bold text-slate-900"
              >
                About FrameLex
              </h2>
              <p className="text-xs font-medium text-indigo-900 mt-0.5">
                See Every Pixel. Speak Every Engine.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close app info"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="p-4 bg-[#F5F3FF]/70 border border-[#E2DFEE] rounded-xl space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-900">
              Forensic Visual Prompt Engineering
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              FrameLex reverse-engineers photographs, illustrations, 3D renders, and architectural scenes into a structured 8-layer visual anatomy, pixel-sampled color swatches, and dialect-ready prompts for Natural / Imagen, Midjourney, Flux.1, SDXL, and AI Video—with no artificial character or word caps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-[#ECFDF5]/60 border border-emerald-200/80 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-950">
                <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Private Account Workspace</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Sign in with Google, GitHub, Microsoft, Magic Link, or Email &amp; Password to access the Studio, persist saved prompts, and reload any past extraction in one click.
              </p>
            </div>

            <div className="p-4 bg-[#FFF4ED]/70 border border-amber-200/80 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <Lock className="w-4 h-4 text-amber-800 shrink-0" />
                <span>Exclusive Personal API Keys</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Each signed-in user enters and binds their own Gemini API key exclusively to their login—verified on every request and never shared with other users.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <Layers className="w-4 h-4 text-indigo-700" />
              <span>8-Layer Forensic Anatomy Architecture</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ANATOMY_LAYER_INDEX.map((layer) => (
                <div
                  key={layer.key}
                  className="p-2.5 bg-white border border-[#E2DFEE] rounded-lg flex items-center gap-2.5"
                >
                  <img
                    src={layer.iconUrl}
                    alt={layer.label}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-md object-cover border border-[#E2DFEE] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {layer.indexCode}. {layer.shortLabel}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {layer.group}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <Keyboard className="w-4 h-4 text-indigo-700" />
              <span>Workflow Shortcuts</span>
            </div>
            <div className="border border-[#E2DFEE] rounded-xl divide-y divide-[#ECEAF6] overflow-hidden">
              {SHORTCUTS.map((item) => (
                <div
                  key={item.keys}
                  className="px-3.5 py-2.5 bg-white flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <span className="text-slate-700">{item.action}</span>
                  <kbd className="px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-950 bg-[#EEF2FF] border border-indigo-200/80 rounded">
                    {item.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
