/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    eslint: {
        ignoreDuringBuilds: true,
    },
    // Ensure we can use Edge functions if needed, though mostly using Node per user plan
};

export default nextConfig;
