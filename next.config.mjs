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
};

export default nextConfig;
