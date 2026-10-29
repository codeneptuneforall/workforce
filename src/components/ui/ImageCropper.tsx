import { useRef, useState, useEffect } from "react";
import { XIcon, RotateCcwIcon } from "lucide-react";

interface ImageCropperProps {
  imageUrl: string;
  onCrop: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export function ImageCropper({ imageUrl, onCrop, onClose }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ clientX: 0, clientY: 0, offsetX: 0, offsetY: 0 });
  const [isCropping, setIsCropping] = useState(false);

  const img = new Image();
  img.src = imageUrl;
  img.onload = () => {
    const boxSize = 280;
    const fit = Math.min(boxSize / img.width, boxSize / img.height);
    const s = fit * 1.4;
    setScale(s);
    setOffset({ x: (boxSize - img.width * s) / 2, y: (boxSize - img.height * s) / 2 });
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      const dx = e.clientX - dragStart.clientX;
      const dy = e.clientY - dragStart.clientY;
      setOffset({ x: dragStart.offsetX + dx, y: dragStart.offsetY + dy });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, dragStart]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ clientX: e.clientX, clientY: e.clientY, offsetX: offset.x, offsetY: offset.y });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.5), 6);
    const boxSize = 280;
    const cx = boxSize / 2;
    const cy = boxSize / 2;
    const relX = cx - offset.x;
    const relY = cy - offset.y;
    setScale(newScale);
    setOffset({ x: cx - relX * (newScale / scale), y: cy - relY * (newScale / scale) });
  };

  const doCrop = () => {
    if (!canvasRef.current || !imageRef.current) return;
    setIsCropping(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setIsCropping(false); return; }

    const boxSize = 280;
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sw = boxSize / scale;
    const sh = boxSize / scale;

    canvas.width = 400;
    canvas.height = 400;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 400, 400);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setIsCropping(false);
    onCrop(dataUrl);
    onClose();
  };

  const doReset = () => {
    const boxSize = 280;
    const fit = Math.min(boxSize / img.width, boxSize / img.height);
    const s = fit * 1.4;
    setScale(s);
    setOffset({ x: (boxSize - img.width * s) / 2, y: (boxSize - img.height * s) / 2 });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm">
      <div className="relative w-full max-w-[640px] p-6 bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">Crop profile picture</h3>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div ref={containerRef} className="relative w-[280px] h-[280px] rounded-full overflow-hidden border border-line bg-canvas shadow-inner cursor-grab active:cursor-grabbing" onMouseDown={onMouseDown} onWheel={onWheel}>
            <canvas ref={canvasRef} className="hidden" />
            <img
              ref={imageRef}
              src={imageUrl}
              className="absolute select-none pointer-events-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: "center center",
                userSelect: "none",
              }}
              alt="Crop"
            />
            <div className="absolute inset-0 rounded-full border-2 border-white/60 shadow-[0_0_0_4px_rgba(255,255,255,0.9)] pointer-events-none" />
          </div>

          <div className="flex items-center gap-3 px-4">
            <button
              type="button"
              onClick={doReset}
              className="p-2 rounded-lg border border-line bg-white text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50"
              title="Reset"
            >
              <RotateCcwIcon className="h-4 w-4" />
            </button>

            <div className="flex-1 h-[2px] bg-line rounded-full">
              <div className="h-full bg-brand-700 rounded-full" style={{ width: Math.min((scale / 6) * 100, 100) }} />
            </div>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onWheel(e as unknown as React.WheelEvent); }}
              className="p-2 rounded-lg border border-line bg-white text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50"
              title="Zoom in"
            >
              <span className="h-4 w-4">+</span>
            </button>
          </div>

          <div className="flex gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg border border-line bg-white text-ink-muted hover:bg-canvas disabled:opacity-50"
              disabled={isCropping}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doCrop}
              className="px-6 py-2 rounded-lg bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCropping}
            >
              {isCropping ? "Cropping..." : "Save crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
