// 로컬 개발 서버: .env 를 읽고 8787 포트로 Hono 앱을 띄운다.
//   npm run dev  →  http://localhost:8787/
import { serve } from "@hono/node-server";
import { loadDotEnv } from "../src/lib/env.js";

loadDotEnv();
const { default: app } = await import("../src/app.js");

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`HR Daily API → http://localhost:${info.port}`);
  console.log("  GET  /v1/feed · /v1/library · /v1/stats · /v1/articles/:id");
  console.log("  GET  /cron/:job  (Authorization: Bearer $CRON_SECRET)");
});
