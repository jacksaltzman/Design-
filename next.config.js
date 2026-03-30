/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/webp"],
  },
  experimental: {
    // Exclude design screenshots from serverless function bundles.
    // They are served as static CDN assets — no need to bundle them.
    outputFileTracingExcludes: {
      "*": ["./public/designs/**"],
    },
  },
};

module.exports = nextConfig;
