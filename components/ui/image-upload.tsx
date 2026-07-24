"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, X, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX = 5 * 1024 * 1024;

/**
 * Image field: upload a file (stored in Shopify Files → CDN URL) or paste a URL.
 * Calls onChange with the resulting URL. Degrades to a plain URL input if upload
 * isn't available (returns an error), so the field always works.
 */
export function ImageUpload({
  value, onChange, disabled, compact,
}: {
  value: string; onChange: (url: string) => void; disabled?: boolean; compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX) return toast("Image is too large (max 5 MB).", "error");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/folp-image", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Upload failed.");
      onChange(data.url);
      toast("Image uploaded.", "success");
    } catch (err: any) {
      toast(err?.message || "Upload failed — you can paste an image URL instead.", "error");
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
        <button type="button" onClick={pick} disabled={disabled || busy}
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
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image URL" className="h-8 text-xs" />
    </div>
  );
}
