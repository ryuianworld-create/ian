import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { getServerToken } from "@/lib/supabase/server";
import { HomeLanding } from "@/components/HomeLanding";
import type { FeedResponse, StatsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const token = await getServerToken();
  let feed: FeedResponse | null = null;
  let error: string | null = null;
  // 피드와 통계를 동시에 부른다. 통계는 실패해도 홈을 막지 않는다.
  const [feedRes, stats] = await Promise.all([
    api.feed(token).then((f) => ({ feed: f, error: null as string | null })).catch((e) => ({ feed: null, error: errorMessage(e) })),
    api.stats().catch((): StatsResponse | null => null),
  ]);
  feed = feedRes.feed;
  error = feedRes.error;

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

  return <HomeLanding feed={feed} stats={stats} />;
}
