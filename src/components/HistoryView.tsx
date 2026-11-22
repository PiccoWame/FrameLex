import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Activity,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  LogIn,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  ActivityActionType,
  CloudActivityEntry,
  CloudSavedPrompt,
  Dialect,
  HistoryRecord,
} from '../types/prompt';
import { DIALECT_META, estimateTokenCount } from '../utils/promptAssembler';
import { copyToClipboard } from '../utils/clipboard';

interface HistoryViewProps {
  user: User | null;
  authReady: boolean;
  onOpenAuthModal: () => void;
  records: HistoryRecord[];
  cloudPrompts: CloudSavedPrompt[];
  cloudActivities: CloudActivityEntry[];
  onLoadRecord: (record: HistoryRecord) => void;
  onLoadCloudPrompt: (prompt: CloudSavedPrompt) => void;
  onDeleteRecord: (id: string) => void;
  onDeleteCloudPrompt: (id: string) => void;
  onClearAll: () => void;
  onGoToStudio: () => void;
}

const ACTION_LABELS: Record<ActivityActionType, string> = {
  analyzed: 'Analyzed Frame',
  batch_analyzed: 'Batch Analyzed',
  enhanced: 'Enhanced Prompt',
  refined: 'Applied Remix',
  saved: 'Saved Prompt',
  modified: 'Modified Prompt',
};

export const HistoryView: React.FC<HistoryViewProps> = ({
  user,
  authReady,
  onOpenAuthModal,
  records,
  cloudPrompts,
  cloudActivities,
  onLoadRecord,
  onLoadCloudPrompt,
  onDeleteRecord,
  onDeleteCloudPrompt,
  onClearAll,
  onGoToStudio,
}) => {
  const [activeTab, setActiveTab] = useState<'prompts' | 'activity'>('prompts');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialectFilter, setDialectFilter] = useState<Dialect | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isCloudMode = Boolean(user);

  const filteredCloudPrompts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cloudPrompts.filter((rec) => {
      if (dialectFilter !== 'all' && rec.activeDialect !== dialectFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        rec.title,
        rec.activePrompt,
        rec.keywords.join(' '),
        rec.anatomy?.subject || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [cloudPrompts, searchQuery, dialectFilter]);

  const filteredLocalRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((rec) => {
      if (dialectFilter !== 'all' && rec.activeDialect !== dialectFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        rec.title,
        rec.analysis.dialects[rec.activeDialect],
        rec.analysis.keywords.join(' '),
        rec.analysis.anatomy.subject,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [records, searchQuery, dialectFilter]);

  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cloudActivities.filter((act) => {
      if (dialectFilter !== 'all' && act.dialect !== dialectFilter) {
        return false;
      }
      if (!q) return true;
      return `${act.title} ${act.summary} ${act.action}`.toLowerCase().includes(q);
    });
  }, [cloudActivities, searchQuery, dialectFilter]);

  const totalItems = isCloudMode ? cloudPrompts.length : records.length;

  const handleCopyPrompt = async (id: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1400);
    }
  };

  const handleExportArchive = () => {
    const payload = isCloudMode ? cloudPrompts : records;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `framelex-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            {isCloudMode ? 'Saved Prompts & Activity' : 'Prompt Archive'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isCloudMode
              ? `Synced to ${user?.email || 'your account'} · ${cloudPrompts.length} saved prompts · ${cloudActivities.length} activity events`
              : 'Temporary browser archive for your current device. Sign in to save prompts permanently and track generation activity.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {totalItems > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportArchive}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-indigo-300 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Archive</span>
              </button>
              <button
                type="button"
                onClick={onClearAll}
                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-rose-700 transition-colors whitespace-nowrap"
              >
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {authReady && !isCloudMode && (
        <div className="bg-[#F5F3FF]/75 border border-[#E2DFEE] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Sign in required to view your saved prompts
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Sign in or create an account to access your private prompt archive, activity timeline, and reload-and-modify history.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        </div>
      )}

      {/* Signed-in Sub-navigation (Saved Prompts vs Activity Log) */}
      {isCloudMode && (
        <div className="flex items-center gap-1 p-1 bg-[#ECEAF6] rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('prompts')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'prompts'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Saved Prompts ({cloudPrompts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'activity'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activity History ({cloudActivities.length})</span>
          </button>
        </div>
      )}

      {isCloudMode && activeTab === 'activity' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter activity by title or action..."
                aria-label="Filter activity log"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#ECEAF6] rounded-lg overflow-x-auto max-w-full">
              {(['all', 'general', 'midjourney', 'flux', 'sdxl', 'video'] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDialectFilter(tab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      dialectFilter === tab
                        ? 'bg-white text-indigo-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'all' ? 'All' : DIALECT_META[tab].shortLabel}
                  </button>
                )
              )}
            </div>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-sm text-slate-600">
                No activity events recorded yet. Analyze, enhance, or save a prompt in the Studio to start your log.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E2DFEE] rounded-xl divide-y divide-[#ECEAF6] shadow-2xs">
              {filteredActivities.map((act) => {
                const linkedPrompt = cloudPrompts.find((p) => p.id === act.promptId);
                const timeLabel = new Date(act.createdAtMs).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={act.id}
                    className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-semibold text-slate-900">
                          {ACTION_LABELS[act.action] || act.action}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="font-medium text-slate-800 truncate max-w-[260px]">
                          {act.title}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {DIALECT_META[act.dialect]?.shortLabel || act.dialect} · Complexity{' '}
                          {act.complexity}/10 · {act.tokenCount} tokens
                        </span>
                      </div>
                      {act.summary && (
                        <p className="text-xs text-slate-600 mt-1">{act.summary}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {timeLabel}
                      </span>
                      {linkedPrompt && (
                        <button
                          type="button"
                          onClick={() => onLoadCloudPrompt(linkedPrompt)}
                          className="px-2.5 py-1 text-xs font-medium text-indigo-800 hover:bg-[#EEF2FF] rounded-md inline-flex items-center gap-1"
                        >
                          <span>Load</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : totalItems === 0 ? (
        <div className="bg-white border border-[#E2DFEE] rounded-xl p-12 text-center shadow-2xs">
          <h2 className="font-display text-base font-semibold text-slate-900">
            No saved prompts yet
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
            {isCloudMode
              ? 'Every generation or manual save in the Studio is stored here so you can reload and modify it anytime.'
              : 'Analyze an image in the Studio or Batch Queue to create prompts. Sign in anytime to sync them permanently.'}
          </p>
          <button
            type="button"
            onClick={onGoToStudio}
            className="mt-5 px-4 py-2 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors"
          >
            Open Studio
          </button>
        </div>
      ) : (
        <>
          {/* Filter & Search Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search titles, subjects, or tokens..."
                aria-label="Search prompt archive"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#ECEAF6] rounded-lg overflow-x-auto max-w-full">
              {(['all', 'general', 'midjourney', 'flux', 'sdxl', 'video'] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDialectFilter(tab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      dialectFilter === tab
                        ? 'bg-white text-indigo-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'all' ? 'All' : DIALECT_META[tab].shortLabel}
                  </button>
                )
              )}
            </div>
          </div>

          {isCloudMode ? (
            filteredCloudPrompts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <p className="text-sm text-slate-600">
                  No saved prompts match your current filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCloudPrompts.map((rec) => {
                  const dateLabel = new Date(rec.updatedAtMs).toLocaleDateString(
                    undefined,
                    { month: 'short', day: 'numeric' }
                  );
                  const tokens = estimateTokenCount(rec.activePrompt);
                  return (
                    <article
                      key={rec.id}
                      className="bg-white border border-[#E2DFEE] rounded-xl overflow-hidden flex flex-col shadow-2xs"
                    >
                      <div className="p-4 flex gap-4">
                        {rec.thumbnailUrl ? (
                          <img
                            src={rec.thumbnailUrl}
                            alt={rec.title}
                            referrerPolicy="no-referrer"
                            className="w-24 h-24 object-cover rounded-lg border border-[#E2DFEE] bg-[#F5F3FF] shrink-0"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-lg border border-[#E2DFEE] bg-[#F5F3FF] shrink-0 flex items-center justify-center text-[11px] font-mono text-indigo-800">
                            {rec.aspectRatioLabel}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h2 className="text-sm font-semibold text-slate-900 truncate">
                            {rec.title}
                          </h2>
                          <div className="text-xs text-slate-500 mt-0.5 tabular-nums flex flex-wrap items-center gap-x-1.5">
                            <span>{DIALECT_META[rec.activeDialect].shortLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span>{rec.aspectRatioLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span>{tokens} tokens</span>
                            <span aria-hidden="true">·</span>
                            <span>Updated {dateLabel}</span>
                            {(rec.manualOverridePrompt || rec.isCustomized) && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-indigo-700 font-medium">Edited</span>
                              </>
                            )}
                          </div>
                          <p className="mt-2 font-mono text-xs text-slate-700 line-clamp-3 leading-relaxed">
                            {rec.activePrompt}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto px-4 py-2.5 border-t border-[#ECEAF6] bg-[#F7F6FB] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1">
                          {rec.colors.slice(0, 5).map((c) => (
                            <span
                              key={c.hex}
                              title={c.hex}
                              className="w-4 h-4 rounded-sm border border-black/10"
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(rec.id, rec.activePrompt)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-[#E2DFEE] rounded-md inline-flex items-center gap-1"
                          >
                            {copiedId === rec.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-700" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onLoadCloudPrompt(rec)}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-800 hover:bg-[#EEF2FF] rounded-md inline-flex items-center gap-1"
                          >
                            <span>Load &amp; Modify</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCloudPrompt(rec.id)}
                            aria-label={`Delete ${rec.title}`}
                            className="p-1 text-slate-400 hover:text-rose-700 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : filteredLocalRecords.length === 0 ? (
            <div className="bg-white border border-[#E2DFEE] rounded-xl p-8 text-center">
              <p className="text-sm text-slate-600">
                No archived prompts match your current filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLocalRecords.map((rec) => {
                const dateLabel = new Date(rec.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                });
                const promptText = rec.analysis.dialects[rec.activeDialect];
                return (
                  <article
                    key={rec.id}
                    className="bg-white border border-[#E2DFEE] rounded-xl overflow-hidden flex flex-col shadow-2xs"
                  >
                    <div className="p-4 flex gap-4">
                      <img
                        src={rec.thumbnailUrl}
                        alt={rec.title}
                        referrerPolicy="no-referrer"
                        className="w-24 h-24 object-cover rounded-lg border border-[#E2DFEE] bg-[#F5F3FF] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold text-slate-900 truncate">
                          {rec.title}
                        </h2>
                        <div className="text-xs text-slate-500 mt-0.5 tabular-nums flex flex-wrap items-center gap-x-1.5">
                          <span>{DIALECT_META[rec.activeDialect].shortLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{rec.aspectRatioLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{dateLabel}</span>
                        </div>
                        <p className="mt-2 font-mono text-xs text-slate-700 line-clamp-3 leading-relaxed">
                          {promptText}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto px-4 py-2.5 border-t border-[#ECEAF6] bg-[#F7F6FB] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        {rec.colors.slice(0, 5).map((c) => (
                          <span
                            key={c.hex}
                            title={c.hex}
                            className="w-4 h-4 rounded-sm border border-black/10"
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(rec.id, promptText)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-[#E2DFEE] rounded-md inline-flex items-center gap-1"
                        >
                          {copiedId === rec.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-700" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onLoadRecord(rec)}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-800 hover:bg-[#EEF2FF] rounded-md inline-flex items-center gap-1"
                        >
                          <span>Load</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(rec.id)}
                          aria-label={`Delete ${rec.title}`}
                          className="p-1 text-slate-400 hover:text-rose-700 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
