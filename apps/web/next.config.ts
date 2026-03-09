// @route apps/web/next.config.ts
import type { NextConfig } from 'next'
import path from 'path'

const config: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: {
    '/api/audio/upload-finalize': [
      './node_modules/ffmpeg-static/ffmpeg',
      './node_modules/ffmpeg-static/index.js',
      './node_modules/ffmpeg-static/package.json',
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
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