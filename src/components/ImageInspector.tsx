import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ImageIcon,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  ZoomIn,
} from 'lucide-react';
import type { ColorSwatch, ImageMetadata } from '../types/prompt';
import { formatBytes } from '../utils/imageProcessing';
import { copyToClipboard } from '../utils/clipboard';
import { SAMPLE_ASSETS, type SampleAsset } from '../data/samples';

interface ImageInspectorProps {
  image: ImageMetadata;
  colors: ColorSwatch[];
  onReplaceImage: () => void;
  onSampleSelect: (sample: SampleAsset) => void;
  onClearImage: () => void;
}

export const ImageInspector: React.FC<ImageInspectorProps> = ({
  image,
  colors,
  onReplaceImage,
  onSampleSelect,
  onClearImage,
}) => {
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [image.previewUrl]);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomOpen]);

  const handleCopyHex = async (hex: string) => {
    const ok = await copyToClipboard(hex);
    if (ok) {
      setCopiedHex(hex);
      setCopiedAll(false);
      setTimeout(() => setCopiedHex((curr) => (curr === hex ? null : curr)), 1600);
    }
  };

  const handleCopyAllPalette = async () => {
    if (colors.length === 0) return;
    const allHexes = colors.map((c) => c.hex).join(', ');
    const ok = await copyToClipboard(allHexes);
    if (ok) {
      setCopiedAll(true);
      setCopiedHex(null);
      setTimeout(() => setCopiedAll(false), 1600);
    }
  };

  return (
    <>
      <div className="bg-white border border-[#E2DFEE] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ECEAF6] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 truncate">
              {image.name}
            </h2>
            <div className="text-xs text-slate-500 tabular-nums mt-0.5 flex flex-wrap items-center gap-x-2">
              <span>
                {image.width} × {image.height}
              </span>
              <span aria-hidden="true">·</span>
              <span>{image.aspectRatioLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{image.mimeType.replace('image/', '').toUpperCase()}</span>
              {image.sizeBytes > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatBytes(image.sizeBytes)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              disabled={imgError}
              title="Inspect full-screen frame"
              aria-label="Inspect full-screen frame"
              className="p-2 text-slate-600 hover:text-indigo-900 hover:bg-[#EEF2FF] disabled:opacity-40 rounded-lg transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setFitMode((m) => (m === 'contain' ? 'cover' : 'contain'))
              }
              title={fitMode === 'contain' ? 'Fill frame' : 'Fit entire frame'}
              aria-label={fitMode === 'contain' ? 'Fill frame' : 'Fit entire frame'}
              className="p-2 text-slate-600 hover:text-indigo-900 hover:bg-[#EEF2FF] rounded-lg transition-colors"
            >
              {fitMode === 'contain' ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onReplaceImage}
              className="px-3 py-1.5 text-xs font-medium text-slate-800 hover:text-slate-900 bg-[#F5F3FF] hover:bg-[#ECEAF6] border border-[#E2DFEE] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Replace</span>
            </button>
            <button
              type="button"
              onClick={onClearImage}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="studio-stage-grid relative aspect-[4/3] max-h-[440px] w-full flex items-center justify-center overflow-hidden p-4">
          {imgError ? (
            <div className="flex flex-col items-center justify-center text-slate-500">
              <ImageIcon className="w-8 h-8 mb-2" />
              <span className="text-xs font-medium">{image.name}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label="Open full-screen image inspection"
              className="group relative max-w-full max-h-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md cursor-zoom-in"
            >
              <img
                src={image.previewUrl}
                alt={`Reference image ${image.name}`}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className={`max-w-full max-h-[408px] rounded-md shadow-sm transition-transform duration-200 ${
                  fitMode === 'cover' ? 'w-full h-full object-cover' : 'object-contain'
                }`}
              />
            </button>
          )}
        </div>

        {/* Real Pixel-Sampled Color Palette */}
        {colors.length > 0 && (
          <div className="px-4 py-3.5 border-t border-[#ECEAF6]">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">
                  Extracted Color Palette
                </span>
                {copiedHex && (
                  <span className="text-[11px] font-medium text-emerald-700 truncate">
                    Copied {copiedHex}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopyAllPalette}
                className="text-[11px] font-medium text-indigo-800 hover:text-indigo-950 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                {copiedAll ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Copied all</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy all hexes</span>
                  </>
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {colors.map((swatch) => {
                const isCopied = copiedHex === swatch.hex;
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => handleCopyHex(swatch.hex)}
                    title={`Click to copy ${swatch.hex}`}
                    aria-label={`Copy color hex ${swatch.hex}`}
                    className={`group text-left rounded-lg border overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                      isCopied
                        ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                        : 'border-[#E2DFEE] hover:border-indigo-400'
                    }`}
                  >
                    <div
                      className="h-8 w-full border-b border-black/5"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <div className="px-2 py-1.5 bg-white flex items-center justify-between gap-1">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-medium text-slate-900 tabular-nums truncate">
                          {isCopied ? 'Copied' : swatch.hex}
                        </div>
                        <div className="text-[10px] text-slate-500 tabular-nums">
                          {swatch.percentage}%
                        </div>
                      </div>
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick switch samples */}
        <div className="px-4 py-3 border-t border-[#ECEAF6] bg-[#F7F6FB] flex items-center justify-between gap-3 overflow-x-auto">
          <span className="text-xs text-slate-600 whitespace-nowrap shrink-0">
            Switch sample:
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {SAMPLE_ASSETS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSampleSelect(s)}
                className="px-2.5 py-1 text-xs font-medium text-slate-800 bg-white border border-[#E2DFEE] hover:border-indigo-400 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Full-Resolution Frame Lightbox */}
      {zoomOpen && !imgError && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Full inspection of ${image.name}`}
          onClick={() => setZoomOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 sm:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl flex items-center justify-between gap-4 pb-3 text-white"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{image.name}</div>
              <div className="text-xs text-slate-300 tabular-nums">
                {image.width} × {image.height} · {image.aspectRatioLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              aria-label="Close full-screen inspection"
              className="p-2 text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <img
            src={image.previewUrl}
            alt={`Full inspection of ${image.name}`}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl border border-white/10"
          />
        </div>
      )}
    </>
  );
};
