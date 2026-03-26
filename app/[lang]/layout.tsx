export default function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  return <div data-lang={params.lang}>{children}</div>;
}
