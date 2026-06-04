const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['maps.googleapis.com', 'lh3.googleusercontent.com'],
  },
};

module.exports = withNextIntl(nextConfig);
