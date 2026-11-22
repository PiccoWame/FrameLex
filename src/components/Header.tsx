import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { ChevronDown, History, Info, KeyRound, LogIn, LogOut, Settings } from 'lucide-react';
import { FRAMELEX_LOGO_URL } from '../data/anatomyCatalog';

export type AppView = 'studio' | 'batch' | 'history' | 'dialects';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onTriggerUpload: () => void;
  user: User | null;
  authReady: boolean;
  profileDisplayName?: string | null;
  savedCount: number;
  usingPersonalKey?: boolean;
  personalKeyPreview?: string | null;
  isWorkspaceUnlocked?: boolean;
  showWorkspaceNav?: boolean;
  onOpenAuthModal: () => void;
  onOpenAccountModal: () => void;
  onOpenAboutModal: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'studio', label: 'Studio' },
  { id: 'batch', label: 'Batch Queue' },
  { id: 'history', label: 'History' },
  { id: 'dialects', label: 'Dialects' },
];

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onNavigate,
  onTriggerUpload,
  user,
  authReady,
  profileDisplayName,
  savedCount,
  usingPersonalKey = false,
  personalKeyPreview,
  isWorkspaceUnlocked = false,
  showWorkspaceNav = false,
  onOpenAuthModal,
  onOpenAccountModal,
  onOpenAboutModal,
  onSignOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const resolvedName =
    profileDisplayName?.trim() ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'FrameLex Creator';

  const displayInitials = (resolvedName || user?.email || 'U')
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#E2DFEE]">
      <div className="max-w-[1360px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('studio')}
          className="inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md"
        >
          <img
            src={FRAMELEX_LOGO_URL}
            alt="FrameLex logo"
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-md object-cover border border-[#E2DFEE] shrink-0"
          />
          <span>FrameLex</span>
        </button>

        {(isWorkspaceUnlocked || showWorkspaceNav) && (
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    isActive
                      ? 'text-slate-900 border-indigo-700 font-semibold'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAboutModal}
            title="About FrameLex & Keyboard Shortcuts"
            aria-label="About FrameLex and keyboard shortcuts"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-[#F5F3FF] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <Info className="w-4 h-4" />
          </button>

          {authReady && !user && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-3 py-2 text-xs font-medium text-slate-800 bg-[#F5F3FF] border border-[#E2DFEE] hover:border-indigo-300 hover:text-slate-900 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-700" />
              <span>Sign In / Sign Up</span>
            </button>
          )}

          {authReady && user && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                title={
                  usingPersonalKey
                    ? `Signed in · Personal key active (${personalKeyPreview || 'configured'})`
                    : 'Signed in · Personal API key required'
                }
                className="px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-[#F5F3FF] border border-[#E2DFEE] hover:border-indigo-300 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={resolvedName}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-semibold flex items-center justify-center">
                    {displayInitials}
                  </span>
                )}
                <span className="max-w-[110px] truncate hidden sm:inline">
                  {resolvedName.split(' ')[0]}
                </span>
                {usingPersonalKey && (
                  <KeyRound className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-68 bg-white border border-[#E2DFEE] rounded-xl shadow-lg py-2 z-40">
                  <div className="px-3.5 py-2 border-b border-[#ECEAF6]">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {resolvedName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {user.email}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                      {savedCount} saved {savedCount === 1 ? 'prompt' : 'prompts'} synced
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenAccountModal();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-[#F5F3FF] flex items-center justify-between gap-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Settings className="w-3.5 h-3.5 text-slate-500" />
                      <span>Account &amp; API Key</span>
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        usingPersonalKey ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {usingPersonalKey ? 'Key Bound' : 'Required'}
                    </span>
                  </button>
                  {isWorkspaceUnlocked && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate('history');
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-[#F5F3FF] flex items-center gap-2"
                    >
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Saved Prompts &amp; Activity</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-[#FFF1F2] hover:text-rose-800 flex items-center gap-2 border-t border-[#ECEAF6] mt-1 pt-2"
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {(isWorkspaceUnlocked || showWorkspaceNav) && (
            <button
              type="button"
              onClick={onTriggerUpload}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-indigo-950 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              Upload Image
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      {(isWorkspaceUnlocked || showWorkspaceNav) && (
        <nav
          aria-label="Mobile Primary"
          className="flex md:hidden items-center gap-5 px-6 py-2 border-t border-[#ECEAF6] overflow-x-auto text-xs font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-1 whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'text-slate-900 border-indigo-700 font-semibold'
                    : 'text-slate-600 border-transparent'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
};
