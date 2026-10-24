import type { Metadata } from "next";
import { LibraryView } from "@/components/LibraryView";

export const metadata: Metadata = { title: "서재" };

export default function LibraryPage() {
  return <LibraryView />;
}
