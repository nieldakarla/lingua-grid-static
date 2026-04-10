"use client";

import { useEffect } from "react";

/** Syncs the <html lang> attribute to the current language code. */
export default function LangSync({ lang }: { lang: string }) {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
