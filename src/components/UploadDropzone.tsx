import React, { useState } from 'react';
import { ImagePlus, Link2, Upload } from 'lucide-react';
import { SAMPLE_ASSETS, type SampleAsset } from '../data/samples';

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onUrlSubmit: (url: string) => Promise<void>;
  onSampleSelect: (sample: SampleAsset) => void;
  isFetchingUrl: boolean;
  urlError: string | null;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFilesSelected,
  onUrlSubmit,
  onSampleSelect,
  isFetchingUrl,
  urlError,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [failedSamples, setFailedSamples] = useState<Record<string, boolean>>({});

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || isFetchingUrl) return;
    await onUrlSubmit(urlInput.trim());
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 border-dashed transition-colors p-8 text-center ${
          isDragging
            ? 'border-indigo-700 bg-[#EEF2FF]'
            : 'border-[#CFC9E6] bg-white hover:border-indigo-400'
        }`}
      >
        <div className="mx-auto w-12 h-12 rounded-xl bg-[#EEF2FF] text-indigo-800 border border-indigo-200/70 flex items-center justify-center mb-4">
          <Upload className="w-5 h-5" />
        </div>
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Drop reference images here
        </h2>
        <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Upload PNG, JPG, or WebP, press Ctrl+V anywhere to paste from clipboard, or drop multiple files to launch a batch sheet.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2">
            <ImagePlus className="w-4 h-4" />
            <span>Choose Files</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                if (files.length > 0) onFilesSelected(files);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <form
          onSubmit={handleFormSubmit}
          className="mt-6 pt-5 border-t border-[#ECEAF6] max-w-lg mx-auto"
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste public image URL (https://...)"
                aria-label="Image URL"
                className="w-full pl-9 pr-3 py-2 text-sm bg-[#F7F6FB] border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-700"
              />
            </div>
            <button
              type="submit"
              disabled={!urlInput.trim() || isFetchingUrl}
              className="px-4 py-2 text-sm font-semibold text-slate-900 bg-[#EEF2FF] hover:bg-indigo-100 border border-indigo-200/80 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isFetchingUrl ? 'Loading...' : 'Load URL'}
            </button>
          </div>
          {urlError && (
            <p role="alert" className="mt-2 text-xs text-rose-700 text-left">
              {urlError}
            </p>
          )}
        </form>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Sample Reference Frames
          </h3>
          <span className="text-xs text-slate-500">
            Click any frame to inspect and reverse-engineer
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SAMPLE_ASSETS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => onSampleSelect(sample)}
              className="group text-left bg-white border border-[#E2DFEE] hover:border-indigo-400 rounded-xl overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <div className="aspect-[4/3] w-full bg-[#F1EFFA] overflow-hidden">
                {failedSamples[sample.id] ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#EEF2FF] to-[#F5F3FF] text-slate-600 p-2 text-center">
                    <ImagePlus className="w-5 h-5 mb-1" />
                    <span className="text-xs font-medium">{sample.title}</span>
                  </div>
                ) : (
                  <img
                    src={sample.url}
                    alt={`${sample.title} — ${sample.category}`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedSamples((prev) => ({ ...prev, [sample.id]: true }))
                    }
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                )}
              </div>
              <div className="p-2.5 bg-white">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {sample.title}
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {sample.category}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
