"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Users, Eye, Braces, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { sendBroadcast } from "@/app/actions/admin";

const VARS = ["{{name}}", "{{code}}", "{{earnings}}", "{{link}}"];

interface AudienceOption {
  label: string;
  count: number;
  status: string[];
}

export function BroadcastComposer({ audiences }: { audiences: AudienceOption[] }) {
  const [audience, setAudience] = useState(audiences[0]);
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
      const res = await sendBroadcast({ subject, body, status: audience.status });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setSubject("");
        setBody("");
        router.refresh();
      }
    });
  };

  const rendered = (body || "Hi {{name}}, your code {{code}} has earned you {{earnings}} so far — keep it up!")
    .replaceAll("{{name}}", "Sarah")
    .replaceAll("{{code}}", "SARAH15")
    .replaceAll("{{earnings}}", "$1,240.00")
    .replaceAll("{{link}}", "affilaite.app/r/SARAH");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Compose broadcast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Users className="size-3.5" /> Audience</Label>
            <div className="flex flex-wrap gap-2">
              {audiences.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setAudience(a)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    audience.label === a.label
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-hairline text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {a.label}
                  <span className="rounded-full bg-background/60 px-1.5 text-xs">{a.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A little something for you…" />
          </div>

          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              placeholder="Write your message. Use variables below to personalize."
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Braces className="size-3" /> Insert:</span>
              {VARS.map((v) => (
                <button
                  key={v}
                  onClick={() => setBody((b) => `${b}${v}`)}
                  className="kbd hover:bg-accent"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-hairline pt-4">
            <Button onClick={send} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send to {audience.count}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="lg:col-span-2 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-4 text-muted-foreground" /> Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-hairline">
            <div className="border-b border-hairline bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">From: affiliates@yourbrand.com</p>
              <p className="mt-0.5 font-medium">{subject || "A little something for you…"}</p>
            </div>
            <div className="space-y-3 p-5">
              <div className="h-6 w-24 rounded bg-primary/15" />
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{rendered}</p>
              <div className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                View dashboard
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Sent via Resend to {audience.count} {audience.label.toLowerCase()}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
