import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,

  // ─── Build Performance ─────────────────────
  // Disable source maps in production (smaller builds, faster uploads)
  productionBrowserSourceMaps: false,

  // React Compiler / strict optimizations
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // ─── Bundle Optimization ───────────────────
  experimental: {
    // Optimize package imports — tree-shake heavy libraries aggressively
    optimizePackageImports: [
      "lucide-react",
      "@base-ui/react",
      "date-fns",
      "recharts",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
  },

  // ─── Compiler options ──────────────────────
  compiler: {
    // Remove console.* in production (except errors)
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },

  // ─── Headers ───────────────────────────────
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/manifest.json",
      headers: [
        { key: "Cache-Control", value: "public, max-age=3600" },
      ],
    },
    // Cache static assets aggressively
    {
      source: "/_next/static/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/images/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=604800" },
      ],
    },
  ],
};

export default nextConfig;
