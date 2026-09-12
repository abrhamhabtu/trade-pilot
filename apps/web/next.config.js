/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `next build` and `next dev` both write here. Building into the running dev
  // server's directory deletes the chunks it is still serving, and the app loads
  // with no CSS until `.next` is cleared. `npm run build:verify` sets this to a
  // scratch directory so a build can be checked while the preview stays up.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  webpack(config, { dev }) {
    // Optional local-preview mode for machines with very little free disk.
    if (dev && process.env.TRADEPILOT_LOW_DISK === '1') config.cache = false;
    return config;
  },
};

module.exports = nextConfig;
