/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp']
  },
  images: {
    domains: ['localhost'],
    unoptimized: true
  },
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    OPENAI_API_BASE: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1'
  }
}

module.exports = nextConfig