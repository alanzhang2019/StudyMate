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
    {
      url: `${BASE}/camp`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE}/camp/works`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE}/camp/prepare`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE}/camp/work/animal-maze-battle`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE}/camp/work/formation-editor`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];
}
