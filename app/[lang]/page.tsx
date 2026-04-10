import { redirect, notFound } from "next/navigation";
import { getAvailableLanguages, getAvailableLevels, getAvailableThemes } from "@/lib/puzzles-static";

interface Props {
  params: { lang: string };
}

export function generateStaticParams() {
  return getAvailableLanguages().map((l) => ({ lang: l.code }));
}

export default function LangRootPage({ params }: Props) {
  const levels = getAvailableLevels(params.lang);
  for (const level of levels) {
    const themes = getAvailableThemes(params.lang, level.code);
    const firstPuzzleId = themes[0]?.puzzles[0]?.id;
    if (firstPuzzleId) redirect(`/${params.lang}/puzzle/${firstPuzzleId}`);
  }
  notFound();
}
