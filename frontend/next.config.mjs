/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Surface uncaught build errors instead of silently passing.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
