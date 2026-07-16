"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Megaphone, Braces, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { sendBroadcast } from "@/app/actions/admin";

const VARS = ["{{name}}", "{{code}}", "{{earnings}}"];

export function GroupMessageComposer({
  groupId,
  groupName,
  memberCount,
}: {
  groupId: string;
  groupName: string;
  memberCount: number;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const send = () => {
    if (!subject.trim() || !body.trim()) {
      toast("Add a subject and message.", "error");
      return;
    }
    start(async () => {
      const res = await sendBroadcast({ subject, body, groupIds: [groupId] });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setSubject("");
        setBody("");
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-4 text-primary" /> Message this group
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Send an announcement to the {memberCount} member{memberCount === 1 ? "" : "s"} of {groupName}. They&apos;ll see
          it in their portal Community tab{" "}
          <span className="text-muted-foreground/80">(and by email when email is connected).</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A quick update for the crew…" />
        </div>
        <div className="space-y-1.5">
          <Label>Message</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Write your message. Use variables below to personalize per member."
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Braces className="size-3" /> Insert:
            </span>
            {VARS.map((v) => (
              <button key={v} onClick={() => setBody((b) => `${b}${v}`)} className="kbd hover:bg-accent">
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end border-t border-hairline pt-4">
          <Button onClick={send} disabled={pending || memberCount === 0}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send to {memberCount}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
