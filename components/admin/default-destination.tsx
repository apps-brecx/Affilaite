"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { setSetting } from "@/app/actions/admin";

export function DefaultDestination({ value }: { value: string }) {
  const [url, setUrl] = useState(value);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const save = () => {
    start(async () => {
      const res = await setSetting("default_destination_url", url.trim());
      toast(res.ok ? "Default destination saved." : res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-4 text-primary" /> Default campaign destination
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Where affiliate referral links land by default. New campaigns start with this; each can override it.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} className="pl-9" placeholder="https://syruvia.com" />
          </div>
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
