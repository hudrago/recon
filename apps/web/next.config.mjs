/** @type {import('next').NextConfig} */
const nextConfig = {
  // This repo's agent/instructions layer lives in .github/ — avoid a second,
  // competing AGENTS.md/CLAUDE.md source being generated inside apps/web.
  agentRules: false,
};

export default nextConfig;
