import { useRef, useState } from "react";
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

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startScale, setStartScale] = useState(1);
  const [isCropping, setIsCropping] = useState(false);

  const img = new Image();
  img.src = imageUrl;
  img.onload = () => {
    const boxSize = 280;
    const scaleToFit = Math.min(boxSize / img.width, boxSize / img.height);
    const initialScale = scaleToFit * 1.5;
    setScale(initialScale);
    const offsetX = (boxSize - img.width * initialScale) / 2;
    const offsetY = (boxSize - img.height * initialScale) / 2;
    setPosition({ x: offsetX, y: offsetY });
  };

  const handleImageMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    setStartScale(scale);
  };

  const handleWindowMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
  };

  const handleWindowMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(startScale * delta, 1), 5);
    setScale(newScale);
    const boxSize = 280;
    const centerX = boxSize / 2;
    const centerY = boxSize / 2;
    const prevPos = { x: position.x, y: position.y };
    const newPosX = centerX - (centerX - prevPos.x) * (newScale / startScale);
    const newPosY = centerY - (centerY - prevPos.y) * (newScale / startScale);
    setPosition({ x: newPosX, y: newPosY });
    setStartScale(newScale);
  };

  const handleCrop = () => {
    if (!canvasRef.current || !imageRef.current) return;
    setIsCropping(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsCropping(false);
      return;
    }

    const boxSize = 280;
    const sourceX = -position.x / scale;
    const sourceY = -position.y / scale;
    const sourceW = boxSize / scale;
    const sourceH = boxSize / scale;

    canvas.width = 400;
    canvas.height = 400;
    ctx.drawImage(
      imageRef.current,
      sourceX, sourceY, sourceW, sourceH,
      0, 0, 400, 400
    );

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setIsCropping(false);
    onCrop(croppedDataUrl);
    onClose();
  };

  const handleReset = () => {
    const boxSize = 280;
    const scaleToFit = Math.min(boxSize / (img.width || boxSize), boxSize / (img.height || boxSize));
    const initialScale = scaleToFit * 1.5;
    setScale(initialScale);
    const offsetX = (boxSize - (img.width || boxSize) * initialScale) / 2;
    const offsetY = (boxSize - (img.height || boxSize) * initialScale) / 2;
    setPosition({ x: offsetX, y: offsetY });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm">
      <div className="relative w-full max-w-[640px] p-6 bg-white rounded-2xl shadow-2xl z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">Crop profile picture</h3>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div
            ref={containerRef}
            className="relative w-[280px] h-[280px] rounded-full overflow-hidden border border-line bg-canvas shadow-inner"
            onWheel={handleWheel}
          >
            <canvas ref={canvasRef} className="hidden" />
            <img
              ref={imageRef}
              src={imageUrl}
              className="absolute select-none cursor-grab active:cursor-grabbing"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
                userSelect: "none",
              }}
              onMouseDown={handleImageMouseDown}
              onDragStart={(e) => e.preventDefault()}
              alt="Crop"
            />
            <div className="absolute inset-0 rounded-full border-2 border-white/60 shadow-[0_0_0_4px_rgba(255,255,255,0.9)] pointer-events-none" />
          </div>

          <div className="flex items-center gap-3 px-4">
            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-lg border border-line bg-white text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset"
            >
              <RotateCcwIcon className="h-4 w-4" />
            </button>

            <div className="flex-1 h-[2px] bg-line rounded-full">
              <div
                className="h-full bg-brand-700 rounded-full transition-all"
                style={{ width: Math.min((scale / 5) * 100, 100) }}
              />
            </div>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); handleWheel(e as unknown as React.WheelEvent); }}
              className="p-2 rounded-lg border border-line bg-white text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
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
              onClick={handleCrop}
              className="px-6 py-2 rounded-lg bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCropping}
            >
              {isCropping ? "Cropping..." : "Save crop"}
            </button>
          </div>
        </div>
      </div>

      <div className="absolute inset-0" onMouseMove={(e) => handleWindowMouseMove(e)} onMouseUp={handleWindowMouseUp} onMouseLeave={handleWindowMouseUp} />
    </div>
  );
}
