/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Silence optional pretty printer required by some deps in Node env
      'pino-pretty': false,
    }
    return config
  },
}

module.exports = nextConfig

