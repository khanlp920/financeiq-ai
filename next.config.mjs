/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse is a CJS package used only in API routes
  serverExternalPackages: ["pdf-parse"],
};
export default nextConfig;
