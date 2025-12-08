import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Enable React strict mode for better debugging
  reactStrictMode: true,

  // Optimize package imports for faster builds
  optimizePackageImports: ["lucide-react"],

  // Include test data files in serverless function bundles
  outputFileTracingIncludes: {
    "/api/admin/prompts/test": [
      "./tests/extraction/ground-truth/**/*",
      "./tests/extraction/documents/**/*",
    ],
  },

  webpack: (config, { isServer }) => {
    if (!config.resolve) {
      config.resolve = {}
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        canvas: false,
        child_process: false,
      }
    }

    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      }
    }

    return config
  },

  // Externalize pdf-parse to avoid bundling issues on serverless
  serverExternalPackages: ["pdf-parse"],
}

export default nextConfig
