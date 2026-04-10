// ---------------------------------------------------------------------------
// UI translations — add a new key for each supported language
// ---------------------------------------------------------------------------

export type SupportedLang = "en" | "pt";

const FALLBACK: SupportedLang = "en";

export interface Translations {
  // Header / filter bar
  howToPlay: string;
  filterLanguage: string;
  filterLevel: string;
  filterCategory: string;
  filterPuzzle: string;

  // Incorrect modal
  notQuiteTitle: string;
  /** @param n mistake count */
  mistakes: (n: number) => string;
  continueBtn: string;
  restartPuzzle: string;

  // Correct modal
  puzzleComplete: string;
  /** @param time formatted mm:ss string */
  finishedIn: (time: string) => string;
  nextPuzzle: string;
  allDone: string;

  // Clues section
  cluesHeader: string;

  // Grammar note
  grammarNote: string;

  // Tutorial chrome (step text stays in English — teaches game mechanics)
  tutorialTitle: string;
  /** @param phase current tutorial number, @param step current step, @param total total steps */
  tutorialPhaseStep: (phase: number, step: number, total: number) => string;
  tutorialNextBtn: string;
  tutorialBackBtn: string;
  tutorialClickCell: string;
  tutorialSolvePuzzle: string;
  tutorialWellDone: string;
  tutorialReady: string;
  tutorialContinueToT2: string;
  tutorialStartPlaying: string;
}

const en: Translations = {
  howToPlay: "How to play",
  filterLanguage: "Language",
  filterLevel: "Level",
  filterCategory: "Category",
  filterPuzzle: "Puzzle",

  notQuiteTitle: "Not quite!",
  mistakes: (n) =>
    `You have ${n} ${n === 1 ? "mistake" : "mistakes"}. Review the clues and try again.`,
  continueBtn: "Continue",
  restartPuzzle: "Restart puzzle",

  puzzleComplete: "Puzzle complete!",
  finishedIn: (time) => `Finished in ${time}`,
  nextPuzzle: "Next puzzle",
  allDone: "✓ All done!",

  cluesHeader: "Clues — click any sentence to hear it",
  grammarNote: "Grammar note",

  tutorialTitle: "LinguaGrid Tutorial",
  tutorialPhaseStep: (phase, step, total) =>
    `Tutorial ${phase} of 2 — Step ${step} of ${total}`,
  tutorialNextBtn: "Next",
  tutorialBackBtn: "Back",
  tutorialClickCell: "↑ Click the highlighted cell above",
  tutorialSolvePuzzle: "↑ Solve the puzzle above",
  tutorialWellDone: "Well done! Tutorial 1 complete.",
  tutorialReady: "You're ready to play! Good luck.",
  tutorialContinueToT2: "Continue to Tutorial 2 →",
  tutorialStartPlaying: "Start playing!",
};

const pt: Translations = {
  howToPlay: "Como jogar",
  filterLanguage: "Idioma",
  filterLevel: "Nível",
  filterCategory: "Categoria",
  filterPuzzle: "Puzzle",

  notQuiteTitle: "Quase lá!",
  mistakes: (n) =>
    `Você tem ${n} ${n === 1 ? "erro" : "erros"}. Revise as dicas e tente novamente.`,
  continueBtn: "Continuar",
  restartPuzzle: "Reiniciar puzzle",

  puzzleComplete: "Puzzle completo!",
  finishedIn: (time) => `Concluído em ${time}`,
  nextPuzzle: "Próximo puzzle",
  allDone: "✓ Tudo pronto!",

  cluesHeader: "Dicas — clique em qualquer frase para ouvir",
  grammarNote: "Nota gramatical",

  tutorialTitle: "Tutorial LinguaGrid",
  tutorialPhaseStep: (phase, step, total) =>
    `Tutorial ${phase} de 2 — Passo ${step} de ${total}`,
  tutorialNextBtn: "Próximo",
  tutorialBackBtn: "Voltar",
  tutorialClickCell: "↑ Clique na célula destacada acima",
  tutorialSolvePuzzle: "↑ Resolva o puzzle acima",
  tutorialWellDone: "Muito bem! Tutorial 1 completo.",
  tutorialReady: "Você está pronto para jogar! Boa sorte.",
  tutorialContinueToT2: "Continuar para o Tutorial 2 →",
  tutorialStartPlaying: "Começar a jogar!",
};

const ALL: Record<SupportedLang, Translations> = { en, pt };

export function useTranslations(lang: string): Translations {
  const key = lang as SupportedLang;
  return ALL[key] ?? ALL[FALLBACK];
}
