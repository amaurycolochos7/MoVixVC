import type { NextConfig } from "next";

const withPWA = require("@ducanh2912/next-pwa").default({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true,
    skipWaiting: true,
    runtimeCaching: [
        {
            // NetworkFirst for API and Supabase
            urlPattern: /^https:\/\/.*supabase\.co\/.*$/,
            handler: "NetworkFirst",
            options: {
                cacheName: "supabase-api-cache",
                expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 5, // Very short cache
                },
                networkTimeoutSeconds: 3,
            },
        },
        {
            // Do not cache obscure implementation details or opaque responses aggressively
            urlPattern: /\/api\/.*/,
            handler: "NetworkFirst",
        }
    ],
});

const nextConfig: NextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default withPWA(nextConfig);


