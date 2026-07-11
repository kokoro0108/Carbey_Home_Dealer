/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  experimental: {
    // Server Actions のボディ上限。エビデンス提出（画像/PDF・最大10MB）を受けるため引き上げる。
    // アプリ側 MAX_SIZE=10MB + multipart オーバーヘッドを吸収して 12MB。
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
}

module.exports = nextConfig
