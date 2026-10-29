"use client";

import { useState, useEffect } from "react";
import ReactEazyCrop from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { XIcon, RotateCcwIcon } from "lucide-react";

interface ImageCropperProps {
  imageUrl: string;
  onCrop: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export function ImageCropper({ imageUrl, onCrop, onClose }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isCropping, setIsCropping] = useState(false);

  // Load original image to get dimensions for canvas drawing
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const i = new Image();
    i.src = imageUrl;
    i.onload = () => setImg(i);
  }, [imageUrl]);

  const onCropChange = (location: { x: number; y: number }) => {
    setCrop(location);
  };

  const onZoomChange = (zoomValue: number) => {
    setZoom(zoomValue);
  };

  const doCrop = () => {
    if (!img) return;
    setIsCropping(true);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsCropping(false);
      return;
    }

    const boxSize = 280;
    const sx = -crop.x / zoom;
    const sy = -crop.y / zoom;
    const sw = boxSize / zoom;
    const sh = boxSize / zoom;

    canvas.width = 400;
    canvas.height = 400;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 400, 400);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setIsCropping(false);
    onCrop(dataUrl);
    onClose();
  };

  const doReset = () => {
    if (!img) return;
    const boxSize = 280;
    const fit = Math.min(boxSize / img.width, boxSize / img.height);
    const s = fit * 1.4;
    setZoom(s);
    setCrop({ x: (boxSize - img.width * s) / 2, y: (boxSize - img.height * s) / 2 });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.5), 3);
    setZoom(newZoom);
    // Zoom toward center of crop box
    const boxSize = 280;
    const cx = boxSize / 2;
    const cy = boxSize / 2;
    const relX = cx - crop.x;
    const relY = cy - crop.y;
    setCrop({ x: cx - relX * (newZoom / zoom), y: cy - relY * (newZoom / zoom) });
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
          <div
            className="relative w-[320px] h-[320px] rounded-full overflow-hidden border border-line bg-canvas shadow-inner"
            onWheel={onWheel}
          >
            <ReactEazyCrop
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              cropShape="round"
              showGrid={true}
              minZoom={0.5}
              maxZoom={3}
              style={{ containerStyle: { width: 320, height: 320 } }}
              restrictPosition={true}
              zoomWithScroll={true}
              zoomSpeed={20}
              keyboardStep={10}
            />
          </div>

          <div className="flex items-center gap-3 px-4">
            <button
              type="button"
              onClick={doReset}
              className="p-2 rounded-lg border border-line bg-white text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset"
            >
              <RotateCcwIcon className="h-4 w-4" />
            </button>

            <div className="flex-1 h-[2px] bg-line rounded-full">
              <div className="h-full bg-brand-700 rounded-full" style={{ width: Math.min(((zoom - 0.5) / 2.5) * 100, 100) }} />
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
              disabled={isCropping || !imageUrl}
            >
              {isCropping ? "Cropping..." : "Save crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
