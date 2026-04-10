import LangSync from "@/components/LangSync";

export default function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  return (
    <>
      <LangSync lang={params.lang} />
      <div data-lang={params.lang}>{children}</div>
    </>
  );
}
