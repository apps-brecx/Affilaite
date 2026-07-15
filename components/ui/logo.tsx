import Link from "next/link";
import { cn } from "@/lib/utils";

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
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      {mark && (
        <span className="relative inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-subtle ring-gilded">
          <span className="font-display text-[15px] font-semibold leading-none">{(text ?? "S").charAt(0).toUpperCase()}</span>
        </span>
      )}
      {wordmark && (
        <span className="font-display text-lg font-semibold tracking-tight text-foreground">
          {text ? (
            text
          ) : (
            <>
              Syruvi<span className="text-gradient-gold">Aite</span>
            </>
          )}
        </span>
      )}
    </Link>
  );
}
