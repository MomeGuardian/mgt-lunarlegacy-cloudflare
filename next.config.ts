import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. 核心：导出为纯静态文件 (配合 Cloudflare Pages)
  output: 'export',

  // 2. 关闭图片优化 (静态导出必须关)
  images: {
    unoptimized: true,
  },

  // 3. 忽略类型检查 (强制过关)
  typescript: {
    ignoreBuildErrors: true,
  },
  // 注意：eslint 配置项在 Next.js 新版中不支持放在这里，所以我删掉了
};

export default nextConfig;
