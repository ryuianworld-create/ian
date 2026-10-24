import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { getServerToken } from "@/lib/supabase/server";
import { HomeView } from "@/components/HomeView";
import type { FeedResponse } from "@/lib/types";

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
  return <HomeView feed={feed} />;
}
