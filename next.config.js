/** @type {import('next').NextConfig} */
const nextConfig = {
  // Moved out of `experimental` — this is the correct key in Next.js 15
  serverExternalPackages: ['mongoose'],

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'olivehaus.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.olivehaus.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'olivehaus-ppma-files.s3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      // Regional S3 hostname (eu-north-1)
      {
        protocol: 'https',
        hostname: 'olivehaus-ppma-files.s3.eu-north-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      // Wildcard for any S3 regional endpoint
      {
        protocol: 'https',
        hostname: '**.s3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      // Alternative S3 format (bucket.s3.region.amazonaws.com)
      {
        protocol: 'https',
        hostname: '**.s3.*.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 3600, // 1 hour
  },

  // Environment variables validation
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },

  // ✅ ENHANCED: Comprehensive security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // XSS Protection (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions policy (disable unused browser features)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // ✅ NEW: Strict Transport Security (HSTS) - Force HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // ✅ NEW: Content Security Policy (CSP)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-inline/eval
              "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
              "img-src 'self' data: https: blob:", // Allow images from S3, CDN, etc.
              "font-src 'self' data:",
              "connect-src 'self' https://*.s3.amazonaws.com https://*.s3.*.amazonaws.com wss: ws:", // API + S3 + WebSocket
              "media-src 'self' https: blob:",
              "object-src 'none'", // Block plugins
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'", // Redundant with X-Frame-Options but more robust
              "upgrade-insecure-requests", // Upgrade HTTP to HTTPS
            ].join('; '),
          },
        ],
      },
      // Specific headers for API routes
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },

  // Redirects — root "/" goes to /login; middleware handles all other auth redirects
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Ignore node-specific modules when bundling for the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Add support for importing SVG files as components
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

  // Compiler options
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error'],
    } : false,
  },

  // Output configuration for static export (if needed)
  output: 'standalone',

  // Power by header
  poweredByHeader: false,

  // Gzip compression
  compress: true,

  // Generate ETags for pages
  generateEtags: true,

  // Page extensions
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],

  // Trailing slash configuration
  trailingSlash: false,

  // Skip trailing slash redirect
  skipTrailingSlashRedirect: true,

  // React strict mode
  reactStrictMode: true,

  // TypeScript configuration
  typescript: {
    // Set to true if you want production builds to continue even with TypeScript errors
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // Set to true if you want production builds to continue even with ESLint errors
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;