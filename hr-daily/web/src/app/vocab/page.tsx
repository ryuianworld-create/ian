import { Suspense } from "react";
import type { Metadata } from "next";
import { VocabView } from "@/components/VocabView";

export const metadata: Metadata = { title: "단어장" };

export default function VocabPage() {
  return (
    <Suspense fallback={<div className="note" style={{ marginTop: 20 }}>단어장을 여는 중입니다…</div>}>
      <VocabView />
    </Suspense>
  );
}
