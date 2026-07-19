import { cn } from "@/lib/utils";

export const GROUP_COLORS: Record<string, string> = {
  emerald: "from-emerald-400 to-emerald-600",
  gold: "from-amber-300 to-yellow-500",
  rose: "from-rose-400 to-pink-600",
  sky: "from-sky-400 to-blue-600",
  violet: "from-violet-400 to-purple-600",
  amber: "from-amber-400 to-orange-500",
};

export function GroupAvatar({
  emoji,
  color,
  imageUrl,
  size = 44,
  className,
}: {
  emoji?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={cn("shrink-0 rounded-2xl object-cover ring-1 ring-black/5", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-black/5",
        GROUP_COLORS[color ?? "emerald"] ?? GROUP_COLORS.emerald,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {emoji || "💬"}
    </span>
  );
}
