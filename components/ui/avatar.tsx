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
  const hue = stringToHue(name);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white ring-1 ring-inset ring-white/10",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(140deg, hsl(${hue} 42% 34%), hsl(${(hue + 40) % 360} 46% 24%))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
