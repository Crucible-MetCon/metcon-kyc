/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma', 'nodemailer', 'pdf-lib'],
  },
  images: {
    // Allow local public assets (logo)
    unoptimized: true,
  },
};

module.exports = nextConfig;
