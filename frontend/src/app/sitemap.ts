import type { MetadataRoute } from 'next';

function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'https://onmicro.ai';
  return raw.replace(/\/$/, '');
}

const PUBLIC_PATHS = [
  '/',
  '/pricing/',
  '/library/',
  '/privacy/',
  '/terms/',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, `${base}/`).toString(),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.6,
  }));
}
