// 잡 이름 → 실행 함수. 크론과 관리자 API 가 공유한다.
import { collectJob } from "./collect";
import { digestJob } from "./digest";
import { runJob, type Log } from "./run";
import { summarizeJob, type SummarizeParams } from "./summarize";
import type { JobName, JobRun } from "../types";

export const JOB_NAMES: readonly JobName[] = ["collect", "summarize", "digest"] as const;

export function isJobName(s: string): s is JobName {
  return (JOB_NAMES as readonly string[]).includes(s);
}

export async function runNamedJob(job: JobName, params: SummarizeParams = {}): Promise<{ run: JobRun; result: unknown; error: string | null }> {
  switch (job) {
    case "collect":
      return runJob(job, (log: Log) => collectJob(log));
    case "summarize":
      return runJob(job, (log: Log) => summarizeJob(log, params));
    case "digest":
      return runJob(job, (log: Log) => digestJob(log));
  }
}
