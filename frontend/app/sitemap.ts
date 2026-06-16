import type { MetadataRoute } from 'next';

const BASE = 'https://aijiangti.cn';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${BASE}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE}/mistake`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE}/history`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ];
}
