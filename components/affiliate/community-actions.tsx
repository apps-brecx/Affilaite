"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, LogOut, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { joinGroup, leaveGroup, replyDirectMessage, markGroupRead, markDmReadByAffiliate } from "@/app/actions/messaging";

export function JoinGroupButton({ groupId }: { groupId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await joinGroup(groupId);
          toast(res.message, res.ok ? "success" : "error");
          if (res.ok) router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Join
    </Button>
  );
}

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await leaveGroup(groupId);
          toast(res.message, res.ok ? "success" : "error");
          if (res.ok) router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Leave
    </Button>
  );
}

export function DmReply() {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const send = () =>
    start(async () => {
      const res = await replyDirectMessage(body);
      if (res.message) toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setBody("");
        router.refresh();
      }
    });
  return (
    <div className="flex items-end gap-2 border-t border-hairline bg-card p-3">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message the team…" rows={1} className="min-h-[44px] flex-1 resize-none" />
      <Button size="icon" aria-label="Send" disabled={pending || !body.trim()} onClick={send}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      </Button>
    </div>
  );
}

export function MarkGroupRead({ groupId }: { groupId: string }) {
  useEffect(() => {
    markGroupRead(groupId);
  }, [groupId]);
  return null;
}

export function MarkDmRead() {
  useEffect(() => {
    markDmReadByAffiliate();
  }, []);
  return null;
}
