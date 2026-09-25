import createNextIntlPlugin from 'next-intl/plugin';

// Locale comes from src/i18n/request.ts (English for now; no locale in the URL)
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV !== 'production';
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').origin;

/**
 * Content Security Policy. Scripts: this site and Razorpay Checkout; inline scripts are allowed
 * because Next.js streams page data through them (a per-request nonce would make every page,
 * including the static landing page, server-rendered). Everything else is locked to what the app
 * uses: the API, Razorpay's payment window and Cloudinary images. No plugins, no framing.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.razorpay.com",
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin} https://*.razorpay.com${isDev ? ' ws:' : ''}`,
  'frame-src https://api.razorpay.com https://checkout.razorpay.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Only once the API is served over HTTPS too; otherwise its http:// calls would be rewritten
  ...(apiOrigin.startsWith('https:') ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // HTTPS only for two years, subdomains included (ignored by browsers over plain HTTP)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Razorpay may ask for payment features; nothing needs the camera, microphone or location
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  transpilePackages: ['@trueco/api-client', '@trueco/types', '@trueco/ui'],
  // Linting runs from the monorepo root (pnpm lint), where the shared ESLint config lives
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // `radix-ui` re-exports every primitive; import only the ones a page uses
    optimizePackageImports: ['radix-ui'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
