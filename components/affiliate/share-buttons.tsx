"use client";

import { Share2, Facebook, Twitter, Mail } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/** Real share actions for the affiliate's referral link. */
export function ShareButtons({ link, code }: { link: string; code: string }) {
  const toast = useToast();
  const text = `Shop with my code ${code} and save — ${link}`;
  const enc = encodeURIComponent;

  const targets = [
    { icon: Twitter, label: "X", href: `https://twitter.com/intent/tweet?text=${enc(text)}` },
    { icon: Facebook, label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}` },
    { icon: Mail, label: "Email", href: `mailto:?subject=${enc("A discount for you")}&body=${enc(text)}` },
  ];

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "My referral link", text, url: link });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(link);
        toast("Link copied — paste it anywhere (Instagram bio, DMs, stories).", "success");
      } catch {
        toast("Couldn't open share — copy your link above.", "error");
      }
    }
  };

  const cls =
    "inline-flex items-center gap-2 rounded-lg border border-hairline bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent";

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={nativeShare} className={cls}>
        <Share2 className="size-4 text-primary" /> Share
      </button>
      {targets.map((t) => (
        <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer" className={cls}>
          <t.icon className="size-4 text-muted-foreground" /> {t.label}
        </a>
      ))}
    </div>
  );
}
