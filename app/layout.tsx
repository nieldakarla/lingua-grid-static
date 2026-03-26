import type { Metadata } from "next";
import { Lato, Noto_Sans } from "next/font/google";
import "./globals.css";

// Lato — body text (fCC design system)
const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  style: ["normal", "italic"],
  variable: "--font-lato",
  display: "swap",
});

// Noto Sans — fallback for CJK and non-Latin scripts (future languages)
const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
});

// Hack-ZeroSlash — monospace headings (fCC design system)
// Loaded as a local font once the woff2 file is placed in public/fonts/
// Until then, system monospace is used as fallback.

export const metadata: Metadata = {
  title: "LinguaGrid — Language Learning Through Logic Puzzles",
  description:
    "Learn languages through logic grid puzzles. Read clues in the target language, reason about relationships, and fill in the grid.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-fcc-bg-secondary">
      <body
        className={`
          ${lato.variable}
          ${notoSans.variable}
          font-sans antialiased
          bg-fcc-bg-secondary text-fcc-fg-primary
          min-h-screen
        `}
      >
        {children}
      </body>
    </html>
  );
}
