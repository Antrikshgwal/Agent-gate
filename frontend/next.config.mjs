/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Surface uncaught build errors instead of silently passing.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },

  // Agent-discovery surfaces. Both URLs are conventional; rewrite to the
  // App Router handlers that actually generate the content.
  async rewrites() {
    return [
      { source: "/.well-known/agent.json", destination: "/api/agent-manifest" },
      { source: "/agents.txt", destination: "/api/agents-txt" },
    ];
  },

  // Hint every HTML response toward the manifest so an agent crawling the
  // marketing site doesn't have to know the well-known path in advance.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Link",
            value: '</.well-known/agent.json>; rel="agent-manifest"; type="application/json"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
