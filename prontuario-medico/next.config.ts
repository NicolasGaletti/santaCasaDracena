import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { montarCspEstatica } from "./src/lib/csp";

const nextConfig: NextConfig = {
  devIndicators: false,
  // A logo é lida do disco (fs) nas rotas de PDF; o trace do Netlify precisa incluí-la.
  outputFileTracingIncludes: {
    '/evolucoes/[id]/pdf': ['./src/assets/logo-santa-casa.png'],
    '/evolucoes/lote/pdf': ['./src/assets/logo-santa-casa.png'],
    '/internacoes/[id]/alta/pdf': ['./src/assets/logo-santa-casa.png'],
  },
  // O e2e de PWA usa build de produção em outro diretório para não colidir com `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async rewrites() {
    // O service worker é gerado pela rota /serwist/sw.js e servido em /sw.js (escopo "/").
    return [{ source: "/sw.js", destination: "/serwist/sw.js" }];
  },
  async headers() {
    return [
      {
        // CSP (com nonce) é montado no proxy; aqui ficam os headers estáticos de todas as rotas.
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // /offline fica fora do matcher do proxy (estática); recebe CSP estática aqui, sem duplicar header.
        source: "/offline",
        headers: [{ key: "Content-Security-Policy", value: montarCspEstatica() }],
      },
      {
        source: "/(sw.js|serwist/:path*)",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default withSerwist(nextConfig);
