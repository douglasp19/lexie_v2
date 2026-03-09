// @route apps/web/next.config.ts
import type { NextConfig } from 'next'
import path from 'path'

const config: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
    serverExternalPackages: ['ffmpeg-static'],
  },
  webpack(webpackConfig) {
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      '@': path.resolve(__dirname),
    }
    return webpackConfig
  },
}

export default config