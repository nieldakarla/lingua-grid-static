import { redirect, notFound } from "next/navigation";
import { getAvailableThemes, getAvailableLanguages, getAvailableLevels } from "@/lib/puzzles-static";

interface Props {
  params: { lang: string; level: string };
}

export function generateStaticParams() {
  const languages = getAvailableLanguages();
  const params: { lang: string; level: string }[] = [];
  for (const lang of languages) {
    const levels = getAvailableLevels(lang.code);
    for (const level of levels) {
      params.push({ lang: lang.code, level: level.code });
    }
  }
  return params;
}

export default function LevelRedirectPage({ params }: Props) {
  const themes = getAvailableThemes(params.lang, params.level);
  const firstPuzzleId = themes[0]?.puzzles[0]?.id;
  if (!firstPuzzleId) notFound();
  redirect(`/${params.lang}/puzzle/${firstPuzzleId}`);
}
