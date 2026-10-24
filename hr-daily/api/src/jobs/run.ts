// 잡 실행 래퍼. job_runs 에 시작 행을 넣고, 로그 줄을 모아, 끝나면 ok/finished_at/log 를 기록한다.
// 크론 핸들러와 관리자 "지금 실행" 이 모두 이 함수를 통해 잡을 돌린다.
import { db, unwrap } from "../lib/supabase";
import type { JobName, JobRun } from "../types";

export type Log = (msg: string) => void;

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

export async function runJob<T>(
  job: JobName,
  fn: (log: Log) => Promise<T>,
): Promise<{ run: JobRun; result: T | null; error: string | null }> {
  const lines: string[] = [];
  const log: Log = (msg) => {
    const line = `${timeFmt.format(new Date())} ${msg}`;
    lines.push(line);
    console.log(`[${job}] ${line}`);
  };

  const started = unwrap(
    await db().from("job_runs").insert({ job }).select("id,started_at").single<{ id: number; started_at: string }>(),
    "job_runs.insert",
  );

  let ok = false;
  let result: T | null = null;
  let error: string | null = null;
  try {
    result = await fn(log);
    ok = true;
  } catch (e) {
    error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    log(`✗ 실패: ${error}`);
    console.error(e);
  }

  const finished_at = new Date().toISOString();
  // 로그가 너무 길면 앞부분만 남긴다(jsonb 크기 보호)
  const logToSave = lines.length > 500 ? [...lines.slice(0, 480), `… (${lines.length - 480} lines omitted)`, ...lines.slice(-20)] : lines;
  const { error: upErr } = await db().from("job_runs").update({ finished_at, ok, log: logToSave }).eq("id", started.id);
  if (upErr) console.error("job_runs.update", upErr.message);

  return {
    run: { id: started.id, job, started_at: started.started_at, finished_at, ok, log: logToSave },
    result,
    error,
  };
}
