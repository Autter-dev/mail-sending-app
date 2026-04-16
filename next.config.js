/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pg', 'pg-boss', 'pino', 'pino-pretty'],
  },
}

module.exports = nextConfig
