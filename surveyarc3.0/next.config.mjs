import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');
/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false, // Disable strict mode to fix ReactQuill

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