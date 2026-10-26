import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  devIndicators: false,
  // O e2e de PWA usa build de produção em outro diretório para não colidir com `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async rewrites() {
    // O service worker é gerado pela rota /serwist/sw.js e servido em /sw.js (escopo "/").
    return [{ source: "/sw.js", destination: "/serwist/sw.js" }];
  },
  async headers() {
    return [
      {
        source: "/(sw.js|serwist/:path*)",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default withSerwist(nextConfig);
