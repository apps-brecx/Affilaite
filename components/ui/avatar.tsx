import { cn, initials, stringToHue } from "@/lib/utils";

export function Avatar({
  name,
  size = 36,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  // Keep avatars in the brand's warm candy band (pink → peach → honey).
  const hue = 330 + (stringToHue(name) % 100);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-inset ring-white/20",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(140deg, hsl(${hue} 90% 64%), hsl(${hue + 24} 84% 54%))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
