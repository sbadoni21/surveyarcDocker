import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.js");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // ✅ REQUIRED for AWS Amplify SSR
  output: "standalone",

  async headers() {
    return [
      {
        // ✅ Allow embedding ONLY for survey form
        source: "/en/form(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "media.assettype.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
