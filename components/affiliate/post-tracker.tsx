"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, ExternalLink, Instagram, Music2, Youtube, Twitter, Facebook, Link2 } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { submitPost, deletePost } from "@/app/actions/social";
import type { PostRow } from "@/lib/social";

const PLATFORMS = [
  { value: "instagram", label: "Instagram", Icon: Instagram },
  { value: "tiktok", label: "TikTok", Icon: Music2 },
  { value: "youtube", label: "YouTube", Icon: Youtube },
  { value: "x", label: "X", Icon: Twitter },
  { value: "facebook", label: "Facebook", Icon: Facebook },
  { value: "other", label: "Other", Icon: Link2 },
] as const;

function iconFor(platform: string) {
  return (PLATFORMS.find((p) => p.value === platform) ?? PLATFORMS[5]).Icon;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function PostTracker({ posts }: { posts: PostRow[] }) {
  const [platform, setPlatform] = useState<string>("instagram");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await submitPost({ url, platform, note });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setUrl("");
        setNote("");
        router.refresh();
      }
    });
  };

  const remove = (id: string) =>
    start(async () => {
      const res = await deletePost(id);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <div className="space-y-6">
      {/* Submit form */}
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-hairline bg-card p-5">
        <div className="space-y-1.5">
          <Label>Platform</Label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPlatform(value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  platform === value ? "border-primary bg-primary/10 text-primary" : "border-hairline text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Link to your post</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://instagram.com/p/…" required />
        </div>
        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={280} placeholder="Reel featuring the summer bundle ☀️" />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !url.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Log post
          </Button>
        </div>
      </form>

      {/* List */}
      {posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No posts logged yet — share your link and add your first one! 📣</p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-card">
          {posts.map((p) => {
            const Icon = iconFor(p.platform);
            return (
              <li key={p.id} className="flex items-center gap-3 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 truncate font-medium hover:text-primary">
                    <span className="truncate">{p.url.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmt(p.createdAt)}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label="Delete post" disabled={pending} onClick={() => remove(p.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
