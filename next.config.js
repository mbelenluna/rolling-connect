/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Generates a self-contained .next/standalone build that traces only the
  // files actually used at runtime — eliminates unused node_modules from the
  // deployment footprint and enables Phase 2 (standalone start command).
  output: 'standalone',
};

module.exports = nextConfig;
