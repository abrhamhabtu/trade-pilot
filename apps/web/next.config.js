/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { dev }) {
    // Optional local-preview mode for machines with very little free disk.
    if (dev && process.env.TRADEPILOT_LOW_DISK === '1') config.cache = false;
    return config;
  },
};

module.exports = nextConfig;
