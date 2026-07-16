import { redirect } from "next/navigation";

/** Mantém bookmarks antigos; a home agora é My Token Usage. */
export default function Page() {
  redirect("/");
}
