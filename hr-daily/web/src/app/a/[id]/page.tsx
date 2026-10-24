import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage, isApiError } from "@/lib/errors";
import { getServerToken } from "@/lib/supabase/server";
import type { ArticleCard, ForbiddenCode, Viewer } from "@/lib/types";
import { ArticleView } from "@/components/ArticleView";
import { ArticlePreview } from "@/components/ArticlePreview";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  try {
    const { article } = await api.article(id, await getServerToken());
    return { title: article.title, description: article.summary.ko.slice(0, 120) };
  } catch (e) {
    const preview = isApiError(e) ? e.body?.preview : undefined;
    return { title: preview?.title ?? "아티클" };
  }
}

export default async function ArticlePage({ params }: Params) {
  const { id } = await params;
  const token = await getServerToken();
  let result: Awaited<ReturnType<typeof api.article>> | null = null;
  let failure: unknown = null;
  try {
    result = await api.article(id, token);
  } catch (e) {
    failure = e;
  }
  if (result) return <ArticleView article={result.article} />;
  // notFound() 는 내부적으로 throw 하므로 try 밖에서 부른다.
  if (isApiError(failure) && failure.status === 404) notFound();
  const e = failure;
  if (isApiError(e) && e.status === 403 && e.body?.preview) {
        const code = (["signup_required", "approval_pending", "rejected"].includes(e.code)
          ? e.code
          : "signup_required") as ForbiddenCode;
        // viewer 는 403 응답에 없으므로 code 에서 유추한다.
        const viewer: Viewer = {
          kind: code === "approval_pending" ? "pending" : code === "rejected" ? "rejected" : "anon",
        };
    return <ArticlePreview preview={e.body.preview as ArticleCard} code={code} viewer={viewer} />;
  }
  return (
      <section>
        <div className="sec-head" style={{ marginTop: 20 }}>
          <span className="eyebrow">&nbsp;</span>
          <h2 className="sec">아티클</h2>
        </div>
        <div className="note">
          <b>아티클을 불러오지 못했습니다.</b>
          <br />
          {errorMessage(e)}
        </div>
      </section>
  );
}
