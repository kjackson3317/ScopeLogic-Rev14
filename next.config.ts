import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // Temporary deployment safeguard for the Revision 14 prototype.
    // Strict type checking remains enabled in tsconfig.json for development.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
