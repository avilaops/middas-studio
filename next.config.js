/** @type {import('next').NextConfig} */
const isGHPages = process.env.DEPLOY_TARGET === 'ghpages';

const nextConfig = {
  reactStrictMode: true,
  output: isGHPages ? 'export' : 'standalone',
  basePath: isGHPages ? '/middas-studio' : '',
  assetPrefix: isGHPages ? '/middas-studio/' : '',
  images: {
    unoptimized: isGHPages ? true : false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

module.exports = nextConfig;
