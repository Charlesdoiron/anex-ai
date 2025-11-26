import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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
