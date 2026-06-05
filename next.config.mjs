/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client"],
  },
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === "edge") {
      if (!config.resolve.fallback) {
        config.resolve.fallback = {};
      }
      if (!config.resolve.alias) {
        config.resolve.alias = {};
      }

      const nodeBuiltins = [
        "crypto", "fs", "module", "os", "path", "async_hooks", "net", "tls",
        "url", "util", "stream", "zlib", "http", "https", "readline", "child_process",
        "buffer", "process", "v8", "perf_hooks", "string_decoder", "querystring",
        "punycode", "events", "dns", "dgram"
      ];

      nodeBuiltins.forEach((builtin) => {
        config.resolve.fallback[builtin] = false;
      });
    }
    return config;
  },
};

export default nextConfig;
