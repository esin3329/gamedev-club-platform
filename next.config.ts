import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Cloudflare Pages 호환 설정 */
  
  // OpenNext for Cloudflare 호환성을 위해 비활성화
  cacheComponents: false,
  partialPrefetching: false,
  
  // Cloudflare는 ISR을 지원하지 않으므로 비활성화
  // (대신 on-demand revalidation 또는 full SSR 사용)
  
  // 이미지 최적화: Cloudflare Images 또는 외부 서비스 사용
  images: {
    unoptimized: true, // Cloudflare Pages는 Next.js Image Optimization 미지원
  },
  
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
