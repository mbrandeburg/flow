import path from 'node:path'
import { fileURLToPath } from 'node:url'

import bundleAnalyzer from '@next/bundle-analyzer'
import withSerwistInit from '@serwist/next'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const withSerwist = withSerwistInit({
  swSrc: 'service-worker/index.ts',
  swDest: 'public/sw.js',
  // Serwist's precache injection runs in the webpack build; `next dev` uses
  // Turbopack, so keep the service worker out of development.
  disable: process.env.NODE_ENV === 'development',
})

const IS_DOCKER = process.env.DOCKER

// Sent on every response. Scripts/styles are left to Next (the app uses inline
// bootstrap scripts, so a strict script-src needs nonces — tracked separately);
// these directives harden clickjacking, MIME sniffing, referrer leakage and
// device APIs without touching rendering.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value:
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
]

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
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  ...(IS_DOCKER && {
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname, '../../'),
  }),
}

// TODO(framework-migration): re-add Sentry (v10 withSentryConfig single-options
// signature + instrumentation files, env-guarded DSN) once wired.
export default withSerwist(withBundleAnalyzer(config))
