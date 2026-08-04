const path = require('path')

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const IS_DOCKER = process.env.DOCKER

/**
 * @type {import('next').NextConfig}
 **/
const config = {
  pageExtensions: ['ts', 'tsx'],
  // Replaces next-transpile-modules (removed): Next 13+ transpiles workspace
  // packages natively via `transpilePackages`.
  transpilePackages: [
    '@flow/internal',
    '@flow/epubjs',
    '@material/material-color-utilities',
  ],
  i18n: {
    locales: ['en-US', 'zh-CN', 'ja-JP', 'de-DE'],
    defaultLocale: 'en-US',
  },
  ...(IS_DOCKER && {
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname, '../../'),
  }),
}

// TODO(framework-migration): re-add Sentry (v10 withSentryConfig single-options
// signature + instrumentation files) and PWA (@ducanh2912/next-pwa or
// @serwist/next) once the core Next 16 build is green.
module.exports = withBundleAnalyzer(config)
