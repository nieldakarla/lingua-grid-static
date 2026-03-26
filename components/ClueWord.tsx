"use client";

import { useAudio } from "@/hooks/useAudio";

export interface ClueWordProps {
  word: string;
  lang?: string;
  audioUrl?: string;   // Phase 2: pre-generated ElevenLabs audio
  highlighted?: boolean;
}

export default function ClueWord({
  word,
  lang = "en",
  audioUrl,
  highlighted = false,
}: ClueWordProps) {
  const { speak } = useAudio(lang);

  function handleClick() {
    if (audioUrl) {
      // Phase 2: use pre-generated audio when available
      new Audio(audioUrl).play();
      return;
    }
    speak(word);
  }

  if (!highlighted) {
    return <span className="mr-1">{word}</span>;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="
        mr-1 inline-block
        text-fcc-blue underline underline-offset-2
        hover:text-fcc-fg-primary
        cursor-pointer transition-colors
        focus-visible:rounded
      "
      aria-label={`Hear pronunciation of "${word}"`}
    >
      {word}
    </button>
  );
}
