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

// The reader is a fully static (SSG) Pages Router app, so a per-request nonce
// can't reach the build-time HTML — `script-src`/`style-src` therefore stay
// `'unsafe-inline'`. The real hardening here is a tight `connect-src` (caps where
// a compromised script — e.g. from a malicious ePub — can exfiltrate to) plus
// locked-down default/frame/object/worker sources.
// NOTE: enabling Google Tag Manager (NEXT_PUBLIC_GTM_ID) needs script-src/img-src/
// connect-src additions for googletagmanager.com.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  // epub.js loads the opened book by fetch()-ing a blob: URL, so connect-src must allow blob:.
  "connect-src 'self' blob: https://api.dropboxapi.com https://content.dropboxapi.com https://notify.dropboxapi.com",
  "frame-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ')

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
  { key: 'Content-Security-Policy', value: csp },
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
