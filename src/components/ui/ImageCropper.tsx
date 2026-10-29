"use client";

import { useState, useEffect } from "react";
import ReactEazyCrop from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { XIcon } from "lucide-react";

interface ImageCropperProps {
  imageUrl: string;
  onCrop: (croppedDataUrl: string) => void;
  onClose: () => void;
}

const BOX_SIZE = 280; // display size of the crop box
const OUTPUT_SIZE = 400; // output image size

export function ImageCropper({ imageUrl, onCrop, onClose }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isCropping, setIsCropping] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  // Load original image and calculate initial centered crop
  useEffect(() => {
    const i = new Image();
    i.src = imageUrl;
    i.onload = () => {
      setImg(i);
      // Calculate initial zoom to fit image within crop box
      const fit = Math.min(BOX_SIZE / i.width, BOX_SIZE / i.height);
      const initialZoom = fit * 1.2;
      setZoom(initialZoom);
      // Center the crop in the image
      const scaledW = i.width * initialZoom;
      const scaledH = i.height * initialZoom;
      setCrop({
        x: (scaledW - BOX_SIZE) / 2,
        y: (scaledH - BOX_SIZE) / 2,
      });
    };
  }, [imageUrl]);

  const onCropChange = (location: { x: number; y: number }) => {
    setCrop(location);
  };

  const onZoomChange = (zoomValue: number) => {
    setZoom(zoomValue);
  };

  const onCropComplete = (
    _croppedArea: { x: number; y: number; width: number; height: number },
    croppedAreaPixels: { x: number; y: number; width: number; height: number }
  ) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const doCrop = () => {
    if (!img || !croppedAreaPixels) return;
    setIsCropping(true);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsCropping(false);
      return;
    }

    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    ctx.drawImage(
      img,
      croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height,
      0, 0, OUTPUT_SIZE, OUTPUT_SIZE
    );
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setIsCropping(false);
    onCrop(dataUrl);
    onClose();
  };

  const doReset = () => {
    if (!img) return;
    const fit = Math.min(BOX_SIZE / img.width, BOX_SIZE / img.height);
    const s = fit * 1.2;
    setZoom(s);
    setCrop({
      x: (img.width * s - BOX_SIZE) / 2,
      y: (img.height * s - BOX_SIZE) / 2,
    });
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
          {/* Crop preview */}
          <div className="relative w-[320px] h-[320px] rounded-full overflow-hidden border border-line bg-canvas shadow-inner">
            <ReactEazyCrop
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropComplete}
              cropShape="round"
              showGrid={false}
              minZoom={0.5}
              maxZoom={4}
              style={{ containerStyle: { width: 320, height: 320 } }}
              restrictPosition={true}
              zoomWithScroll={true}
              zoomSpeed={20}
              keyboardStep={10}
            />
            {/* Round mask overlay */}
            <div className="absolute inset-0 rounded-full border-2 border-white/70 shadow-[0_0_0_3px_rgba(255,255,255,0.9)] pointer-events-none" />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 px-4">
            <button
              type="button"
              onClick={doReset}
              className="p-2 rounded-lg border border-line bg-white text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset"
            >
              Reset
            </button>

            <div className="flex-1 h-[2px] bg-line rounded-full">
              <div className="h-full bg-brand-700 rounded-full" style={{ width: Math.min(((zoom - 0.5) / 3.5) * 100, 100) }} />
            </div>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setZoom((z) => Math.min(z + 0.2, 3)); }}
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
              onClick={doCrop}
              className="px-6 py-2 rounded-lg bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCropping || !croppedAreaPixels}
            >
              {isCropping ? "Cropping..." : "Save crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
