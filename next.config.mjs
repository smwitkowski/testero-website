/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Enable static image imports
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
