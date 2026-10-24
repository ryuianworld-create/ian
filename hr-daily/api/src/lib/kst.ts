// KST(Asia/Seoul) 날짜 유틸. 서버(Vercel)는 UTC 로 돌기 때문에 "오늘" 은 항상 여기서 계산한다.

const TZ = "Asia/Seoul";
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD (KST) */
export function kstToday(now: Date = new Date()): string {
  return fmt.format(now); // en-CA 로케일은 YYYY-MM-DD 형식
}

/** YYYY-MM-DD 문자열의 요일 (0=일 … 6=토). 달력 날짜 자체의 요일이므로 시간대 무관 */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 실제 존재하는 달력 날짜인지 (2026-02-30 같은 값 거름) */
export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 임의 날짜 문자열(pubDate 등) → YYYY-MM-DD, 못 읽으면 null */
export function toDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** 두 YYYY-MM-DD 사이 일수 (a - b) */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86_400_000);
}

/** 한국어 날짜 표기: 2026년 10월 24일 (금) */
export function formatKoDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wd = ["일", "월", "화", "수", "목", "금", "토"][weekdayOf(date)];
  return `${y}년 ${m}월 ${d}일 (${wd})`;
}
