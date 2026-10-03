import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: '/wrong-notebook',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/wrong-notebook',
  },
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
};

export default nextConfig;
