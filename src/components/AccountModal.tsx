import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Check,
  Eye,
  EyeOff,
  History,
  KeyRound,
  LogOut,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import type { CloudUserProfile, UserApiKeyConfig } from '../types/prompt';
import {
  deleteUserApiKeyConfig,
  maskApiKey,
  saveUserApiKeyConfig,
  updateUserDisplayName,
} from '../services/firestoreService';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  cloudProfile: CloudUserProfile | null;
  activityCount: number;
  savedCount: number;
  apiKeyConfig: UserApiKeyConfig | null;
  onOpenHistory: () => void;
  onSignOut: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  user,
  cloudProfile,
  activityCount,
  savedCount,
  apiKeyConfig,
  onOpenHistory,
  onSignOut,
}) => {
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keyLabelInput, setKeyLabelInput] = useState('');
  const [usePersonalKey, setUsePersonalKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isDeletingKey, setIsDeletingKey] = useState(false);
  const [keyNotice, setKeyNotice] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    setDisplayNameInput(
      cloudProfile?.displayName || user.displayName || user.email?.split('@')[0] || ''
    );
    setApiKeyInput(apiKeyConfig?.geminiApiKey || '');
    setKeyLabelInput(apiKeyConfig?.label || 'Personal Gemini Key');
    setUsePersonalKey(Boolean(apiKeyConfig?.usePersonalKey && apiKeyConfig?.geminiApiKey));
    setProfileNotice(null);
    setProfileError(null);
    setKeyNotice(null);
    setKeyError(null);
    setShowKey(false);
  }, [isOpen, user, cloudProfile, apiKeyConfig]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const isPersonalKeyActive = Boolean(
    apiKeyConfig?.usePersonalKey && apiKeyConfig?.geminiApiKey
  );

  const initials = (
    cloudProfile?.displayName ||
    user.displayName ||
    user.email ||
    'U'
  )
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);
    setProfileError(null);
    const trimmed = displayNameInput.trim();
    if (!trimmed) {
      setProfileError('Display name cannot be empty.');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateUserDisplayName(user, trimmed);
      setProfileNotice('Profile display name updated.');
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : 'Could not update profile.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleVerifyKey = async () => {
    setKeyNotice(null);
    setKeyError(null);
    const trimmedKey = apiKeyInput.trim();
    if (trimmedKey.length < 20 || /\s/.test(trimmedKey)) {
      setKeyError('Enter a valid Gemini API key before verifying.');
      return;
    }

    setIsVerifyingKey(true);
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
        throw new Error(payload?.error || 'Key verification failed.');
      }
      setKeyNotice(
        `Verified key (${payload.keyPreview || maskApiKey(trimmedKey)}) on your signed-in account.`
      );
    } catch (err) {
      setKeyError(
        err instanceof Error ? err.message : 'Unable to verify Gemini API key.'
      );
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const handleSaveKeySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyNotice(null);
    setKeyError(null);
    const trimmedKey = apiKeyInput.trim();

    if (usePersonalKey && (trimmedKey.length < 20 || /\s/.test(trimmedKey))) {
      setKeyError('Enter a valid Gemini API key (at least 20 characters, no spaces) to enable Personal Key mode.');
      return;
    }

    setIsSavingKey(true);
    try {
      await saveUserApiKeyConfig(user, {
        geminiApiKey: trimmedKey,
        usePersonalKey: Boolean(usePersonalKey && trimmedKey),
        label: keyLabelInput || 'Personal Gemini Key',
      });
      setKeyNotice(
        usePersonalKey && trimmedKey
          ? 'Personal API key saved and bound exclusively to your account.'
          : 'API key settings updated (Workspace Default mode active).'
      );
    } catch (err) {
      setKeyError(
        err instanceof Error ? err.message : 'Could not save API key configuration.'
      );
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRemoveKey = async () => {
    setKeyNotice(null);
    setKeyError(null);
    setIsDeletingKey(true);
    try {
      await deleteUserApiKeyConfig(user.uid);
      setApiKeyInput('');
      setKeyLabelInput('Personal Gemini Key');
      setUsePersonalKey(false);
      setKeyNotice('Personal API key removed. Your account now uses the Workspace Default key.');
    } catch (err) {
      setKeyError(
        err instanceof Error ? err.message : 'Could not remove personal API key.'
      );
    } finally {
      setIsDeletingKey(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-white border border-[#E2DFEE] rounded-2xl shadow-xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-[#E2DFEE] bg-[#F5F3FF]/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={cloudProfile?.displayName || user.displayName || 'Account'}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-[#E2DFEE] shrink-0"
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-indigo-700 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <h2
                id="account-modal-title"
                className="font-display text-lg font-bold text-slate-900 truncate"
              >
                Account &amp; Personal API Key
              </h2>
              <p className="text-xs text-slate-600 truncate">
                Signed in as {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close account settings"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Account Usage Overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-[#EEF2FF]/70 border border-[#D8E0FC] rounded-xl">
              <div className="text-[11px] font-medium text-indigo-900/75">
                Generations
              </div>
              <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
                {cloudProfile?.generationCount ?? 0}
              </div>
            </div>
            <div className="p-3 bg-[#F5F3FF]/75 border border-[#E2D9FA] rounded-xl">
              <div className="text-[11px] font-medium text-violet-900/75">
                Saved Prompts
              </div>
              <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
                {savedCount}
              </div>
            </div>
            <div className="p-3 bg-[#ECFDF5]/75 border border-[#CDEEE0] rounded-xl">
              <div className="text-[11px] font-medium text-emerald-900/75">
                Activity Events
              </div>
              <div className="mt-1 font-display text-xl font-bold text-slate-900 tabular-nums">
                {activityCount}
              </div>
            </div>
          </div>

          {/* Profile Name Form */}
          <form
            onSubmit={handleSaveProfile}
            className="p-4 border border-[#E2DFEE] rounded-xl space-y-3"
          >
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-indigo-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                Creator Profile
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1">
                <label
                  htmlFor="account-display-name"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Display Name
                </label>
                <input
                  id="account-display-name"
                  type="text"
                  maxLength={120}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 focus:outline-none focus:border-indigo-700"
                />
              </div>
              <div className="sm:self-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-indigo-950 bg-[#F5F3FF] border border-[#E2DFEE] hover:bg-[#ECE8FE] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </div>

            {profileNotice && (
              <p className="text-xs text-emerald-700">{profileNotice}</p>
            )}
            {profileError && (
              <p className="text-xs text-rose-700">{profileError}</p>
            )}
          </form>

          {/* Personal Account-Bounded Gemini API Key */}
          <form
            onSubmit={handleSaveKeySettings}
            className="p-4 border border-[#E2DFEE] rounded-xl space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-700" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Account-Bounded Gemini API Key
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Optionally use your own Gemini API key exclusively for your signed-in account. When disabled or unset, FrameLex uses the workspace key.
                </p>
              </div>

              <span
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border whitespace-nowrap ${
                  isPersonalKeyActive
                    ? 'bg-[#ECFDF5] text-emerald-800 border-emerald-200'
                    : 'bg-[#F7F6FB] text-slate-700 border-[#E2DFEE]'
                }`}
              >
                {isPersonalKeyActive
                  ? `Personal Key (${apiKeyConfig?.keyPreview || 'Active'})`
                  : 'Workspace Default Key'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="personal-gemini-key"
                  className="block text-[11px] font-medium text-slate-600 mb-1"
                >
                  Personal Gemini API Key
                </label>
                <div className="relative">
                  <input
                    id="personal-gemini-key"
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIza..."
                    className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-[#F7F6FB] border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                  >
                    {showKey ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="personal-key-label"
                  className="block text-[11px] font-medium text-slate-600 mb-1"
                >
                  Key Label
                </label>
                <input
                  id="personal-key-label"
                  type="text"
                  maxLength={80}
                  value={keyLabelInput}
                  onChange={(e) => setKeyLabelInput(e.target.value)}
                  placeholder="Personal Studio Key"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 focus:outline-none focus:border-indigo-700"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 bg-[#F7F6FB] border border-[#E2DFEE] rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={usePersonalKey}
                onChange={(e) => setUsePersonalKey(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-700 focus:ring-indigo-700"
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Route my Gemini requests through this personal key
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Isolated to your authenticated UID. Requests attach your verified session token and are never shared with guests or other users.
                </div>
              </div>
            </label>

            {keyNotice && (
              <div className="p-2.5 bg-[#ECFDF5] border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{keyNotice}</span>
              </div>
            )}
            {keyError && (
              <div
                role="alert"
                className="p-2.5 bg-[#FFF1F2] border border-rose-200 rounded-lg text-xs text-rose-800"
              >
                {keyError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isVerifyingKey || !apiKeyInput.trim()}
                  onClick={handleVerifyKey}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-indigo-300 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
                  <span>{isVerifyingKey ? 'Verifying...' : 'Verify Key'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSavingKey}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isSavingKey ? 'Saving...' : 'Save Key Settings'}
                </button>
              </div>

              {apiKeyConfig && (
                <button
                  type="button"
                  disabled={isDeletingKey}
                  onClick={handleRemoveKey}
                  className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-[#FFF1F2] hover:bg-rose-100 border border-rose-200 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingKey ? 'Removing...' : 'Remove Key'}</span>
                </button>
              )}
            </div>
          </form>

          {/* Footer Quick Actions */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenHistory();
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              <span>View Saved Prompts &amp; Activity</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
