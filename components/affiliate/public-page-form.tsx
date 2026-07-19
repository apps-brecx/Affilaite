"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink, AtSign } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { useToast } from "@/components/ui/toast";
import { updatePublicProfile } from "@/app/actions/social";

export function PublicPageForm({
  handle,
  bio,
  appUrl,
}: {
  handle: string | null;
  bio: string | null;
  appUrl: string;
}) {
  const [handleVal, setHandleVal] = useState(handle ?? "");
  const [bioVal, setBioVal] = useState(bio ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const publicUrl = handleVal ? `${appUrl}/p/${handleVal.toLowerCase()}` : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await updatePublicProfile({ handle: handleVal, bio: bioVal });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Handle</Label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="handle"
            value={handleVal}
            onChange={(e) => setHandleVal(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
            className="pl-9"
            placeholder="yourname"
            required
          />
        </div>
        {publicUrl && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate text-muted-foreground hover:text-primary">
              <span className="truncate">{publicUrl.replace(/^https?:\/\//, "")}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
            <CopyButton value={publicUrl} />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Bio</Label>
        <Textarea value={bioVal} onChange={(e) => setBioVal(e.target.value)} rows={3} maxLength={240} placeholder="Coffee lover ☕ · sharing my daily picks & the best deals." />
        <p className="text-[11px] text-muted-foreground">{bioVal.length}/240</p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save page
        </Button>
      </div>
    </form>
  );
}
