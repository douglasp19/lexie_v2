import type { NextConfig } from 'next'
import path from 'path'

const config: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
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
