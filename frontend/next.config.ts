/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_VALHALLA_URL: process.env.NEXT_PUBLIC_VALHALLA_URL || 'https://valhalla1.openstreetmap.de/route',
    NEXT_PUBLIC_USE_MOCK_API: process.env.NEXT_PUBLIC_USE_MOCK_API || 'false',
    NEXT_PUBLIC_DEBUG_ROUTING: process.env.NEXT_PUBLIC_DEBUG_ROUTING || 'false',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tile.openstreetmap.org',
      },
      {
        protocol: 'https',
        hostname: '*.tile.openstreetmap.org',
      },
    ],
  },

  turbopack: {

  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }
    return config;
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/api/routing/:path*',
        destination: `${process.env.NEXT_PUBLIC_VALHALLA_URL ||
          'https://valhalla1.openstreetmap.de/route'
          }/:path*`,
      },
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/:path*`,
      },
    ];
  },

  experimental: {},

  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },

  output: process.env.VERCEL ? undefined : 'standalone',

  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  trailingSlash: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  productionBrowserSourceMaps:
    process.env.NODE_ENV !== 'production',

  allowedDevOrigins: ['172.16.3.2'],

};

module.exports = nextConfig;
