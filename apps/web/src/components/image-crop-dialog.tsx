"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button, Eyebrow } from "@/components/ui";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required so drawing a Supabase-hosted image doesn't taint the canvas.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the image."));
    img.src = src;
  });
}

/**
 * Draw the selected region to an offscreen canvas at a fixed output size and
 * export WebP. Baking the crop (instead of storing focal-point metadata)
 * keeps one stored file that displays consistently everywhere, and the fixed
 * output size downscales oversized photos below the upload cap for free.
 */
async function cropToBlob(
  src: string,
  area: Area,
  outWidth: number,
  outHeight: number
): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    outWidth,
    outHeight
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't export the crop."))),
      "image/webp",
      0.9
    );
  });
}

/**
 * Modal pan/zoom cropper (react-easy-crop). The mask is locked to the shape
 * the UI actually renders — circle for avatars, wide rect for banners — so
 * the preview matches the final display exactly. Confirm bakes the crop to a
 * `{outWidth}×{outHeight}` WebP blob and hands it back; Cancel hands back
 * nothing and the caller uploads nothing.
 */
export function ImageCropDialog({
  title,
  src,
  aspect,
  shape,
  outWidth,
  outHeight,
  onConfirm,
  onCancel,
}: {
  title: string;
  src: string;
  aspect: number;
  shape: "round" | "rect";
  outWidth: number;
  outHeight: number;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  async function apply() {
    if (!areaPixels) return;
    setBusy(true);
    setError(null);
    try {
      onConfirm(await cropToBlob(src, areaPixels, outWidth, outHeight));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't crop the image.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg border border-hairline bg-surface-3 p-5">
        <Eyebrow>{title}</Eyebrow>
        <div className="relative mt-4 h-72 w-full overflow-hidden bg-canvas">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={4}
            aspect={aspect}
            cropShape={shape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setAreaPixels(pixels)}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-caption text-ink-subtle">Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-ink"
            aria-label="Zoom"
          />
        </div>
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-caption text-primary">{error}</p>
          <div className="flex shrink-0 gap-2">
            <Button variant="tertiary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={busy || !areaPixels}>
              {busy ? "Applying…" : "Apply"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
