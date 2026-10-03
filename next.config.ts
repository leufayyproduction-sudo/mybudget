import type { NextConfig } from 'next';
const config: NextConfig = { devIndicators: false, distDir: process.env.MYBUDGET_BUILD_DIR || '.next',
 ...(process.env.MYBUDGET_LOW_MEMORY==='1'?{experimental:{cpus:1,webpackBuildWorker:false,webpackMemoryOptimizations:true}}:{})
};
export default config;
