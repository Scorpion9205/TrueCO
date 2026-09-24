import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    // The signed-in app has nothing for search engines; only the public site is indexed
    rules: { userAgent: '*', allow: '/', disallow: ['/app/', '/api/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
