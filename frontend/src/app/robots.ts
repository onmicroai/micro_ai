import type { MetadataRoute } from 'next';

function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'https://onmicro.ai';
  return raw.replace(/\/$/, '');
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: [`${base}/sitemap.xml`, `${base}/blog/sitemap-index.xml`],
  };
}
