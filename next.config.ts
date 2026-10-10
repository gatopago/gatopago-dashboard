import type { NextConfig } from 'next';
import { settings } from './src/lib/settings';

// Read at build: a missing or invalid setting fails it.
void settings;

const config: NextConfig = {
  poweredByHeader: false,
  // `next dev` would otherwise write AGENTS.md and CLAUDE.md into the repo.
  agentRules: false,
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] }];
  },
};
export default config;
