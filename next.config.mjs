/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client"],
  },
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === "edge" || nextRuntime === undefined) {
      if (!config.resolve.fallback) {
        config.resolve.fallback = {};
      }
      config.resolve.fallback.fs = false;
      config.resolve.fallback.path = false;
      config.resolve.fallback.crypto = false;
    }
    return config;
  },
};

export default nextConfig;
