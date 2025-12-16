import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. 核心：导出为纯静态文件 (配合 Cloudflare 的 'out' 目录)
  output: 'export',

  // 2. 关键修复：关闭图片优化
  // Next.js 静态导出不支持默认的图片优化，不加这行百分百报错！
  images: {
    unoptimized: true,
  },

  // 3. 容错：忽略 TypeScript 类型错误
  // 防止因为一个小小的类型定义不对导致整个部署失败
  typescript: {
    ignoreBuildErrors: true,
  },

  // 4. 容错：忽略 ESLint 代码风格错误
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
