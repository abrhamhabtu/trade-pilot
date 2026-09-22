import { fileURLToPath } from 'node:url';

// Point Tailwind at its config explicitly. Left to itself it looks in the
// working directory, which is not apps/web when a server is started from the
// repo root, and the app then renders with no styles.
const config = {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
};

export default config;
