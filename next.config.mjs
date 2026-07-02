/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }
    // Prevent server builds from trying to bundle browser-only ONNX/WASM
    if (isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false }
    }
    return config
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dl.dropboxusercontent.com' },
      { protocol: 'https', hostname: 'www.dropbox.com' },
    ],
  },
}

export default nextConfig
