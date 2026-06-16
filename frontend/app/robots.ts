import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/parent/', '/mistake/session/'],
      },
    ],
    sitemap: 'https://aijiangti.cn/sitemap.xml',
  };
}
