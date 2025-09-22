import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {}
  },
  images: {
    remotePatterns: [
    
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
       {
        protocol: "https",
        hostname: 'media.assettype.com',
      },
    ],
  },
};
export default withNextIntl(nextConfig);