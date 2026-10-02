import type { NextConfig } from 'next';
const config: NextConfig = { devIndicators: false, distDir: process.env.MYBUDGET_BUILD_DIR || '.next' };
export default config;
