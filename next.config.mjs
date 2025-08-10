/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Configure image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Webpack configuration to suppress warnings
  webpack: (config, { isServer }) => {
    // Suppress specific warnings
    config.ignoreWarnings = [
      // Ignore critical dependency warnings from Supabase
      {
        module: /node_modules\/@supabase\/realtime-js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];
    
    return config;
  },

  // Redirect development-only routes away in production
  async redirects() {
    const baseRedirects = [
      // Legacy content routes to new unified routing
      {
        source: '/content/hub/:slug*',
        destination: '/content/hub/:slug*',
        permanent: true,
      },
      {
        source: '/content/spokes/:slug*',
        destination: '/content/spoke/:slug*',
        permanent: true,
      },
      // Keep existing blog routes for backward compatibility
      {
        source: '/blog/:slug*',
        destination: '/blog/:slug*',
        permanent: false,
      },
    ];

    const productionOnlyRedirects = process.env.NODE_ENV === 'production'
      ? [
          {
            source: '/test-marquee',
            destination: '/',
            permanent: false,
          },
        ]
      : [];

    return [...baseRedirects, ...productionOnlyRedirects];
  },

  // Add rewrites for unified content routing
  async rewrites() {
    return [
      // Rewrite unified content routes to the catch-all page
      {
        source: '/content/blog/:slug*',
        destination: '/content/blog/:slug*',
      },
      {
        source: '/content/hub/:slug*',
        destination: '/content/hub/:slug*',
      },
      {
        source: '/content/spoke/:slug*',
        destination: '/content/spoke/:slug*',
      },
    ];
  },
};

export default nextConfig;
