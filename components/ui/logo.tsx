import Link from "next/link";
import { cn } from "@/lib/utils";

/** The Sipfluence "drop-bubble" — a syrup drop shaped like a speech bubble, with reward sparkles. */
export function DropBubble({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 112 104" className={className} aria-hidden="true">
      <g transform="translate(6,3)">
        <path
          d="M 50 6 C 50 6 78 34 84 52 C 88 64 86 74 78 82 C 71 89 61 92.5 50 92.5 C 44 92.5 38.5 91.4 33.8 89.3 C 28 92.8 20.5 94.6 14.5 94.9 C 12.6 95 11.9 92.9 13.3 91.6 C 16.6 88.6 19.6 84.6 20.9 80.4 C 16.2 74.6 14 66 16 52 C 18.6 34 50 6 50 6 Z"
          fill="#FF5C9E"
        />
        <path
          d="M 36.5 34 C 31 41 27.5 49 27.8 57.5 C 28 61.5 30.8 63.6 33.9 62.4 C 36.8 61.3 37.6 58.3 37.3 55 C 36.8 48.6 38.4 42.6 41.8 37.6 C 43.6 34.9 42.6 31.8 40 31 C 38.6 30.6 37.5 32.7 36.5 34 Z"
          fill="#FFFFFF"
          fillOpacity="0.9"
        />
        <path
          d="M 86.5 11.5 C 87.333 17.62 88.88 19.167 95.0 20.0 C 88.88 20.833 87.333 22.38 86.5 28.5 C 85.667 22.38 84.12 20.833 78.0 20.0 C 84.12 19.167 85.667 17.62 86.5 11.5 Z"
          fill="#FFC94D"
        />
        <path
          d="M 71.0 4.9 C 71.4508 8.212 72.288 9.0492 75.6 9.5 C 72.288 9.9508 71.4508 10.788 71.0 14.1 C 70.5492 10.788 69.712 9.9508 66.4 9.5 C 69.712 9.0492 70.5492 8.212 71.0 4.9 Z"
          fill="#FFC94D"
        />
      </g>
    </svg>
  );
}

export function Logo({
  href = "/",
  className,
  mark = true,
  wordmark = true,
  text,
}: {
  href?: string;
  className?: string;
  mark?: boolean;
  wordmark?: boolean;
  text?: string;
}) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2", className)}>
      {mark && <DropBubble className="size-8 shrink-0 transition-transform group-hover:-rotate-6" />}
      {wordmark && (
        <span className="font-display text-xl font-bold tracking-tight text-foreground">
          {text ?? "Sipfluence"}
        </span>
      )}
    </Link>
  );
}
