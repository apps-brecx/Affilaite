import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  className,
  mark = true,
  wordmark = true,
}: {
  href?: string;
  className?: string;
  mark?: boolean;
  wordmark?: boolean;
}) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      {mark && (
        <span className="relative inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-subtle ring-gilded">
          <svg viewBox="0 0 24 24" className="size-4.5" fill="none" aria-hidden>
            <path
              d="M12 3.2 4.5 20.8h3.35l1.55-3.9h5.2l1.55 3.9h3.35L12 3.2Zm-1.35 10.9L12 8.9l1.35 5.2h-2.7Z"
              fill="currentColor"
            />
          </svg>
        </span>
      )}
      {wordmark && (
        <span className="font-display text-lg font-semibold tracking-tight text-foreground">
          Affil<span className="text-gradient-gold">aite</span>
        </span>
      )}
    </Link>
  );
}
