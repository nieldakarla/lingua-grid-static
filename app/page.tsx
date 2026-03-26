import { redirect } from "next/navigation";
import { getFirstPuzzleId } from "@/lib/puzzles-static";

export default function RootPage() {
  const id = getFirstPuzzleId();
  if (id) redirect(`/en/puzzle/${id}`);
  redirect("/en/puzzle/not-found");
}
