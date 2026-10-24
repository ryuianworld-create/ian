import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 폴더에 다른 lockfile 이 있어도 이 패키지를 워크스페이스 루트로 본다.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
