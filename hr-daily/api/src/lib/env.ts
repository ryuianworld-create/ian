// 환경변수 접근. 필수값이 비어 있으면 호출 시점에 명확한 에러를 낸다(모듈 로드 시점이 아니라).
import fs from "node:fs";
import path from "node:path";

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? undefined : v;
}

export function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`환경변수 ${name} 이(가) 설정되지 않았다`);
  return v;
}

/** ADMIN_EMAILS — 쉼표 구분, 소문자 정규화 */
export function adminEmails(): Set<string> {
  return new Set(
    (env("ADMIN_EMAILS") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function webUrl(): string {
  return (env("WEB_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * 로컬 스크립트용 .env 로더(의존성 없이). 이미 설정된 값은 덮어쓰지 않는다.
 * Vercel 에서는 호출하지 않는다 — 환경변수는 대시보드에서 주입된다.
 */
export function loadDotEnv(file = path.resolve(process.cwd(), ".env")): void {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
