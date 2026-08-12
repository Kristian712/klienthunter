const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Žádné externí obrázky – fotky firem měl jen Google Places, který jsme kvůli licenci vypnuli.
  images: {
    domains: [],
  },
  experimental: {
    serverComponentsExternalPackages: ['cheerio', 'undici'],
  },
};

module.exports = withNextIntl(nextConfig);
