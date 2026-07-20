/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Banner/sample images are posted to Server Actions as base64 data URLs
    // (client caps files at ~1.8MB), so lift the default 1MB body limit.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
