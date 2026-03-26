export interface EmojiHeaderProps {
  emoji?: string | null;
  label: string;
}

export default function EmojiHeader({ emoji, label }: EmojiHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-1 text-center min-w-0">
      {emoji && (
        <span className="text-xl leading-none" role="img" aria-hidden="true">
          {emoji}
        </span>
      )}
      <span className="text-xs text-fcc-fg-muted font-sans leading-tight break-words">
        {label}
      </span>
    </div>
  );
}
