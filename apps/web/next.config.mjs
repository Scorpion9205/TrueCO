import createNextIntlPlugin from 'next-intl/plugin';

// Locale comes from src/i18n/request.ts (English for now; no locale in the URL)
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
