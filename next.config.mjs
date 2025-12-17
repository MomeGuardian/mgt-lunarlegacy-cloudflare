/** @type {import('next').NextConfig} */
const nextConfig = {
  // ❌ 删掉 output: 'export' (这一行必须删掉！)
  
  // ✅ 保持图片优化关闭 (Cloudflare 免费版还是建议关掉，或者你可以试着打开)
  images: {
    unoptimized: true,
  },
  
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
