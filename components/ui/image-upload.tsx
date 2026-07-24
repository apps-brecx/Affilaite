"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, X, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX = 10 * 1024 * 1024; // 10 MB source

/**
 * Downscale + compress an image in the browser to a compact data URL. No server
 * or Shopify scope needed — it just works. Big source photos become ~100–250 KB.
 */
function compressImage(file: File, maxDim = 1100, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (Math.max(width, height) > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable."));
      // Flatten onto white so JPEG (no alpha) doesn't go black behind transparency.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image.")); };
    img.src = url;
  });
}

/** Image field: pick a photo (compressed + embedded) or paste a URL. */
export function ImageUpload({
  value, onChange, disabled, compact,
}: {
  value: string; onChange: (url: string) => void; disabled?: boolean; compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Please choose an image file.", "error");
    if (file.size > MAX) return toast("Image is too large (max 10 MB).", "error");
    setBusy(true);
    try {
      let dataUrl = await compressImage(file);
      // If still heavy, compress harder so the page stays light.
      if (dataUrl.length > 900_000) dataUrl = await compressImage(file, 850, 0.62);
      onChange(dataUrl);
      toast("Image added.", "success");
    } catch (err: any) {
      toast(err?.message || "Couldn't add that image.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={`relative shrink-0 overflow-hidden rounded-lg border border-hairline bg-muted ${compact ? "size-10" : "size-14"}`}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground"><ImageIcon className="size-4" /></span>
          )}
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Upload
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")} disabled={disabled} className="rounded-md p-1.5 text-muted-foreground hover:bg-danger-soft hover:text-danger" aria-label="Remove">
            <X className="size-4" />
          </button>
        )}
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
      </div>
      {!value?.startsWith("data:") && (
        <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image URL" className="h-8 text-xs" />
      )}
    </div>
  );
}
