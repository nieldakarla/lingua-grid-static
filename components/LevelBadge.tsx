// CEFR level badge — colors chosen for readability on fCC dark backgrounds

const LEVEL_STYLES: Record<string, string> = {
  A1: "bg-fcc-green    text-fcc-green-dark",
  A2: "bg-fcc-blue     text-fcc-blue-dark",
  B1: "bg-fcc-yellow   text-fcc-yellow-dark",
  B2: "bg-fcc-yellow   text-fcc-yellow-dark",
  C1: "bg-fcc-purple   text-fcc-purple-dark",
  C2: "bg-fcc-purple   text-fcc-purple-dark",
};

export interface LevelBadgeProps {
  level: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_STYLES = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
};

export default function LevelBadge({ level, size = "md" }: LevelBadgeProps) {
  const code = level.toUpperCase();
  const colors = LEVEL_STYLES[code] ?? "bg-fcc-fg-muted text-fcc-bg-primary";
  return (
    <span
      className={`inline-block font-mono font-bold rounded ${SIZE_STYLES[size]} ${colors}`}
      aria-label={`CEFR level ${code}`}
    >
      {code}
    </span>
  );
}
