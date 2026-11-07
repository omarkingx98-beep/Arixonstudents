import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Check, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import { cropAndCompressAvatar } from '../lib/avatarService';

interface AvatarCropModalProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (result: {
    fullDataUrl: string;
    thumbDataUrl: string;
    fullSizeKb: number;
    thumbSizeKb: number;
  }) => Promise<void>;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  imageSrc,
  onClose,
  onCropComplete,
}) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle Mouse / Touch Dragging
  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleApplyCrop = async () => {
    const img = imageRef.current;
    if (!img) return;

    try {
      setIsProcessing(true);
      setErrorMsg(null);

      // Natural dimensions of the loaded image
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      // Crop dimension based on min side and zoom
      const baseSide = Math.min(naturalWidth, naturalHeight);
      const scaledSide = Math.max(32, Math.floor(baseSide / zoom));

      // Calculate center offsets relative to image natural dimensions
      const centerX = naturalWidth / 2 - (offset.x * (naturalWidth / 250));
      const centerY = naturalHeight / 2 - (offset.y * (naturalHeight / 250));

      const cropX = Math.max(0, Math.min(naturalWidth - scaledSide, centerX - scaledSide / 2));
      const cropY = Math.max(0, Math.min(naturalHeight - scaledSide, centerY - scaledSide / 2));

      const result = await cropAndCompressAvatar(img, {
        x: Math.floor(cropX),
        y: Math.floor(cropY),
        size: Math.floor(scaledSide),
      });

      await onCropComplete(result);
      onClose();
    } catch (err: any) {
      console.error('[AvatarCropModal] Compression error:', err);
      setErrorMsg(err.message || 'فشل ضغط الصورة، يرجى المحاولة بصورة أخرى.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div 
        id="avatar-crop-card"
        className="w-full max-w-sm bg-white dark:bg-[#111625] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 text-slate-900 dark:text-slate-100 flex flex-col space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-sm sm:text-base">تعديل وقص صورة الملف الشخصي</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Policy Warning */}
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>تنبيه: لا ترفع صورًا غير لائقة، والمخالفة تعرّضك للمنع الفوري.</span>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Interactive Crop Viewport with Circular Mask */}
        <div
          ref={containerRef}
          onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
          onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={(e) => handlePointerDown(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={handlePointerUp}
          className="relative w-64 h-64 mx-auto rounded-3xl overflow-hidden bg-slate-950 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none border border-slate-800"
        >
          {/* Circular mask overlay */}
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
            <div className="w-52 h-52 rounded-full border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
          </div>

          <img
            ref={imageRef}
            src={imageSrc}
            alt="صورة للقص"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
            className="max-w-none max-h-none pointer-events-none select-none transition-transform duration-75"
            draggable={false}
          />
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-between gap-3 px-2">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="تصغير"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
          />

          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="تكبير"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[10px] text-center text-slate-400">
          اسحب الصورة لتحريكها واستخدم شريط التكبير لضبط الدائرة بدقة
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleApplyCrop}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ الضغط والحفظ...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>قص وتطبيق الصورة</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
