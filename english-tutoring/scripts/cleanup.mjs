// 요약이 끝난 글의 원문 임시 파일을 지운다.
// inbox 에서 status === "done" 인 항목의 data/raw/*.md 를 삭제한다.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const inboxPath = path.join(ROOT, "data", "inbox.json");
const inbox = JSON.parse(fs.readFileSync(inboxPath, "utf8"));

let removed = 0;
for (const entry of inbox) {
  if (entry.status !== "done" || !entry.raw) continue;
  const file = path.join(ROOT, entry.raw);
  if (fs.existsSync(file)) { fs.unlinkSync(file); removed++; console.log("삭제 " + entry.raw); }
  delete entry.raw;
}
fs.writeFileSync(inboxPath, JSON.stringify(inbox, null, 2) + "\n");
console.log(`원문 ${removed}건 삭제.`);
