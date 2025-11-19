import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      if (!config.resolve) {
        config.resolve = {}
      }
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        canvas: false,
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
  serverExternalPackages: ["pdf-parse"],
}

export default nextConfig
