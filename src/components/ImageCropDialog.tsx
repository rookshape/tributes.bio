import { useEffect, useRef, useState } from "react";
import { Button, Dialog } from "./ui";

const VIEWPORT = 280;
const OUTPUT = 512;

/**
 * Square crop for profile photos. Uploading a wide screenshot previously
 * produced an object-fit centre crop the creator had no say in; here they set
 * the framing, and the file that reaches Storage is already square and bounded,
 * so the public page never downloads a full-size original.
 */
export function ImageCropDialog({
  file,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setImage(null);
      return;
    }

    const url = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => {
      setImage(element);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    element.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file) return null;

  // Scale that makes the shorter edge fill the viewport, so there is never a gap.
  const baseScale = image
    ? VIEWPORT / Math.min(image.naturalWidth, image.naturalHeight)
    : 1;
  const scale = baseScale * zoom;
  const drawnWidth = (image?.naturalWidth ?? 0) * scale;
  const drawnHeight = (image?.naturalHeight ?? 0) * scale;

  const clamp = (next: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(VIEWPORT - drawnWidth, next.x)),
    y: Math.min(0, Math.max(VIEWPORT - drawnHeight, next.y)),
  });

  const confirm = () => {
    if (!image) return;
    setWorking(true);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const context = canvas.getContext("2d");

    if (!context) {
      setWorking(false);
      return;
    }

    const ratio = OUTPUT / VIEWPORT;
    context.drawImage(
      image,
      offset.x * ratio,
      offset.y * ratio,
      drawnWidth * ratio,
      drawnHeight * ratio,
    );

    canvas.toBlob(
      (blob) => {
        setWorking(false);
        if (!blob) return;
        onConfirm(
          new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
            type: "image/jpeg",
          }),
        );
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <Dialog
      footer={
        <>
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button loading={working} onClick={confirm} variant="accent">
            Use photo
          </Button>
        </>
      }
      onClose={onCancel}
      open
      size="sm"
      title="Crop your photo"
    >
      <div
        className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-full bg-surface-sunken active:cursor-grabbing"
        onPointerDown={(event) => {
          dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          setOffset(
            clamp({
              x: event.clientX - dragRef.current.x,
              y: event.clientY - dragRef.current.y,
            }),
          );
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        style={{ width: VIEWPORT, height: VIEWPORT }}
      >
        {image ? (
          <img
            alt=""
            className="max-w-none select-none"
            draggable={false}
            src={image.src}
            style={{
              width: drawnWidth,
              height: drawnHeight,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        ) : null}
      </div>

      <label className="mt-5 block" htmlFor="crop-zoom">
        <span className="mb-2 block text-detail font-medium text-content-muted">Zoom</span>
        <input
          className="theme-slider bg-surface-sunken"
          id="crop-zoom"
          max="3"
          min="1"
          onChange={(event) => {
            setZoom(Number(event.target.value));
            setOffset((current) => clamp(current));
          }}
          step="0.05"
          type="range"
          value={zoom}
        />
      </label>
      <p className="mt-2 text-caption text-content-subtle">Drag the photo to reposition it.</p>
    </Dialog>
  );
}
