/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // API Proxy - chuyển /api requests sang Railway backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/:path*`,
      },
    ];
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
  },

  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // Production optimizations
  swcMinify: true,
  productionBrowserSourceMaps: false,

  // Experimental features for better performance
  experimental: {
    optimizeCss: false, // Disabled to reduce build memory usage
  },

  // HTTP Cache-Control headers
  async headers() {
    return [
      {
        // Static assets của Next.js: cache 1 năm (immutable vì có content hash)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Ảnh trong /public: cache 7 ngày
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
