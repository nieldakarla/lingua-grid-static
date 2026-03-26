"use client";

import Image from "next/image";
import { useAudio } from "@/hooks/useAudio";

export interface Clue {
  id: string;
  text: string;
  clueType: string;
}

export interface ClueListProps {
  clues: Clue[];
  lang?: string;
}

function ClueRow({ clue, index, lang }: { clue: Clue; index: number; lang: string }) {
  const { speak } = useAudio(lang);

  return (
    <li className="flex items-start gap-3 py-1.5">
      <span className="font-mono text-fcc-fg-muted shrink-0 w-5 text-right">
        {index + 1}.
      </span>
      <span className="flex-1 text-fcc-fg-primary leading-relaxed">
        {clue.text}
      </span>
      <button
        type="button"
        onClick={() => speak(clue.text.replace(/\p{Emoji_Presentation}\s*/gu, "").trim())}
        className="shrink-0 text-fcc-fg-muted hover:text-fcc-yellow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fcc-focus rounded"
        aria-label={`Play clue ${index + 1}`}
      >
        <Image
          src="/icons/play_circle.svg"
          alt=""
          width={22}
          height={22}
          className="opacity-60 hover:opacity-100 transition-opacity"
        />
      </button>
    </li>
  );
}

export default function ClueList({ clues, lang = "en" }: ClueListProps) {
  return (
    <ol>
      {clues.map((clue, i) => (
        <ClueRow key={clue.id} clue={clue} index={i} lang={lang} />
      ))}
    </ol>
  );
}
