import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { getServerToken } from "@/lib/supabase/server";
import { HomeJournal } from "@/components/HomeJournal";
import { HomeLanding } from "@/components/HomeLanding";
import { getDesign } from "@/lib/design";
import type { Article, FeedResponse, StatsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const token = await getServerToken();
  let feed: FeedResponse | null = null;
  let error: string | null = null;
  try {
    feed = await api.feed(token);
  } catch (e) {
    error = errorMessage(e);
  }

  if (!feed) {
    return (
      <section>
        <div className="sec-head" style={{ marginTop: 20 }}>
          <span className="eyebrow">&nbsp;</span>
          <h2 className="sec">오늘의 아티클</h2>
        </div>
        <div className="note">
          <b>데이터를 불러오지 못했습니다.</b>
          <br />
          {error}
        </div>
      </section>
    );
  }

  // 통계와 오늘 글 전체(단어 미리보기용)는 실패해도 홈을 막지 않는다
  const [stats, today] = await Promise.all([
    api.stats().catch((): StatsResponse | null => null),
    feed.today && !feed.today.locked
      ? api.article(feed.today.id, token).then((r) => r.article).catch((): Article | null => null)
      : Promise.resolve<Article | null>(null),
  ]);

  const design = await getDesign();
  if (design === "b") return <HomeLanding feed={feed} stats={stats} today={today} />;
  return <HomeJournal feed={feed} stats={stats} today={today} />;
}
