import React from 'react';
import { ArrowUpRight, CheckCircle2, Download, Play, Trash2, Upload } from 'lucide-react';
import type { BatchQueueItem, Dialect } from '../types/prompt';

interface BatchQueueViewProps {
  items: BatchQueueItem[];
  activeDialect: Dialect;
  isRunning: boolean;
  onAddFiles: (files: File[]) => void;
  onRunBatch: () => void;
  onRemoveItem: (id: string) => void;
  onClearCompleted: () => void;
  onOpenInStudio: (item: BatchQueueItem) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
}

export const BatchQueueView: React.FC<BatchQueueViewProps> = ({
  items,
  activeDialect,
  isRunning,
  onAddFiles,
  onRunBatch,
  onRemoveItem,
  onClearCompleted,
  onOpenInStudio,
  onExportCsv,
  onExportJson,
}) => {
  const queuedCount = items.filter((i) => i.status === 'queued' || i.status === 'error').length;
  const doneCount = items.filter((i) => i.status === 'done').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Batch Extraction Queue
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Process multiple reference frames sequentially and export structured prompt sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="cursor-pointer px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-indigo-300 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap">
            <Upload className="w-3.5 h-3.5 text-indigo-700" />
            <span>Add Images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                if (files.length > 0) onAddFiles(files);
                e.target.value = '';
              }}
            />
          </label>

          {doneCount > 0 && (
            <>
              <button
                type="button"
                onClick={onExportCsv}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-indigo-300 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={onExportJson}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-indigo-300 rounded-lg transition-colors whitespace-nowrap"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={onClearCompleted}
                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                Clear Completed
              </button>
            </>
          )}

          <button
            type="button"
            disabled={queuedCount === 0 || isRunning}
            onClick={onRunBatch}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {isRunning
                ? 'Processing Queue...'
                : `Analyze Queued (${queuedCount})`}
            </span>
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-[#E2DFEE] rounded-xl p-12 text-center shadow-2xs">
          <h2 className="font-display text-base font-semibold text-slate-900">
            No images in queue
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
            Add multiple files here or drop a folder of reference images anywhere in the Studio to build a batch queue.
          </p>
          <label className="mt-5 cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors">
            <Upload className="w-4 h-4" />
            <span>Select Multiple Images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                if (files.length > 0) onAddFiles(files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      ) : (
        <div className="bg-white border border-[#E2DFEE] rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2DFEE] bg-[#F7F6FB] text-xs font-semibold text-slate-700">
                  <th className="py-3 px-4 w-20">Frame</th>
                  <th className="py-3 px-4">File &amp; Dimensions</th>
                  <th className="py-3 px-4">Extracted Prompt ({activeDialect})</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEAF6] text-xs">
                {items.map((item) => {
                  const promptPreview = item.analysis
                    ? item.analysis.dialects[activeDialect]
                    : '';
                  return (
                    <tr key={item.id} className="hover:bg-[#F7F6FB]/70 align-top">
                      <td className="py-3 px-4">
                        <img
                          src={item.image.thumbnailUrl}
                          alt={item.image.name}
                          referrerPolicy="no-referrer"
                          className="w-14 h-11 object-cover rounded border border-[#E2DFEE] bg-[#F5F3FF]"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 truncate max-w-[180px]">
                          {item.image.name}
                        </div>
                        <div className="text-slate-500 tabular-nums mt-0.5">
                          {item.image.width} × {item.image.height} · {item.image.aspectRatioLabel}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        {item.status === 'done' && promptPreview ? (
                          <p className="font-mono text-[11px] text-slate-700 line-clamp-3">
                            {promptPreview}
                          </p>
                        ) : item.status === 'error' ? (
                          <p className="text-rose-700">{item.error || 'Failed to analyze'}</p>
                        ) : (
                          <span className="text-slate-400">
                            {item.status === 'analyzing'
                              ? 'Extracting visual anatomy...'
                              : 'Waiting in queue'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.status === 'done' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </span>
                        ) : item.status === 'analyzing' ? (
                          <span className="text-indigo-700 font-medium">Running</span>
                        ) : item.status === 'error' ? (
                          <span className="text-rose-700 font-medium">Error</span>
                        ) : (
                          <span className="text-slate-600">Queued</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {item.status === 'done' && (
                            <button
                              type="button"
                              onClick={() => onOpenInStudio(item)}
                              className="px-2.5 py-1 font-medium text-indigo-800 hover:bg-[#EEF2FF] rounded-md inline-flex items-center gap-1"
                            >
                              <span>Inspect</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            aria-label={`Remove ${item.image.name}`}
                            className="p-1.5 text-slate-400 hover:text-rose-700 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
