import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Check, Move, Crop } from 'lucide-react';

interface ImageCropperModalProps {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedBase64: string) => Promise<void> | void;
  loading?: boolean;
}

export function ImageCropperModal({
  open,
  imageSrc,
  onClose,
  onCropComplete,
  loading = false,
}: ImageCropperModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset when new image is provided
  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [open, imageSrc]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleApplyCrop = async () => {
    if (!imageRef.current || !containerRef.current) return;

    const canvas = document.createElement('canvas');
    const cropSize = 320; // High resolution square/circle
    canvas.width = cropSize;
    canvas.height = cropSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Mask center inside container
    const maskCenterX = containerRect.width / 2;
    const maskCenterY = containerRect.height / 2;
    const maskRadius = Math.min(containerRect.width, containerRect.height) * 0.42;

    // Source image dimensions when displayed
    const renderedWidth = img.width * zoom;
    const renderedHeight = img.height * zoom;

    // Image top-left relative to container center
    const imgDisplayedX = maskCenterX - (renderedWidth / 2) + pan.x;
    const imgDisplayedY = maskCenterY - (renderedHeight / 2) + pan.y;

    // Calculate crop rectangle in display coordinates
    const cropDisplayX = maskCenterX - maskRadius;
    const cropDisplayY = maskCenterY - maskRadius;
    const cropDisplaySize = maskRadius * 2;

    // Map display coordinates back to natural image coordinates
    const scaleFactorX = img.naturalWidth / renderedWidth;
    const scaleFactorY = img.naturalHeight / renderedHeight;

    const sourceX = (cropDisplayX - imgDisplayedX) * scaleFactorX;
    const sourceY = (cropDisplayY - imgDisplayedY) * scaleFactorY;
    const sourceSizeX = cropDisplaySize * scaleFactorX;
    const sourceSizeY = cropDisplaySize * scaleFactorY;

    // High quality smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceSizeX,
      sourceSizeY,
      0,
      0,
      cropSize,
      cropSize
    );

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    await onCropComplete(croppedDataUrl);
  };

  if (!imageSrc) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="محرر واقتصاص الصورة الشخصية"
      description="اضبط تمركز الصورة وتكبيرها لتظهر بأفضل شكل في ملفك الشخصي"
      size="md"
    >
      <div className="space-y-4 select-none dir-rtl font-sans text-right">
        {/* Interactive Viewport Area */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative w-full h-72 sm:h-80 bg-slate-950 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing flex items-center justify-center border border-[var(--border-subtle)] shadow-inner touch-none"
        >
          {/* Background grid */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />

          {/* Draggable Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop Target"
            draggable={false}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.08s ease-out',
              maxWidth: '85%',
              maxHeight: '85%',
              objectFit: 'contain',
            }}
            className="pointer-events-none select-none"
          />

          {/* Circular Mask Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dark overlay surrounding circle */}
            <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] relative">
              {/* Corner guide marks */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20 -translate-y-1/2" />
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20 -translate-x-1/2" />
            </div>
          </div>

          {/* Drag hint badge */}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-white/80 pointer-events-none flex items-center gap-1.5 border border-white/10">
            <Move className="h-3 w-3" />
            <span>اسحب الصورة للتحريك</span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Crop className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>مستوى التكبير: {Math.round(zoom * 100)}%</span>
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>إعادة ضبط التمركز</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-2 bg-[var(--surface)] rounded-lg appearance-none cursor-pointer accent-[var(--brand-primary)]"
            />
            <ZoomIn className="h-4 w-4 text-[var(--brand-primary)] shrink-0" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="text-xs font-bold"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleApplyCrop}
            loading={loading}
            className="text-xs font-black px-6 gap-2 bg-gradient-to-r from-[var(--brand-primary)] to-cyan-600 text-white shadow-md cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>تأكيد واقتصاص الصورة</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
