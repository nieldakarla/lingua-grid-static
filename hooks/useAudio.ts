"use client";

import { useCallback, useRef } from "react";

// Maps our ISO 639-1 language codes to BCP 47 tags used by the Web Speech API
const LANG_TO_BCP47: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-BR",
  ja: "ja-JP",
  zh: "zh-CN",
  ko: "ko-KR",
  fr: "fr-FR",
};

function toBCP47(langCode: string): string {
  return LANG_TO_BCP47[langCode] ?? langCode;
}

/**
 * useAudio — wraps the Web Speech API for word-level pronunciation.
 *
 * @param langCode  ISO 639-1 language code ("en", "es", etc.)
 * @returns speak(word) — reads the word aloud; fails silently if unavailable
 *
 * Phase 2: when audioUrl is provided on an Item, the ClueWord component
 * should pass it directly to an <audio> element instead of using this hook.
 */
export function useAudio(langCode: string) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(
    (word: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      // Cancel anything currently playing
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = toBCP47(langCode);
      utterance.rate = 0.9;  // slightly slower — clearer for learners

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [langCode]
  );

  return { speak };
}
