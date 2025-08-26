import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add proper Content Security Policy headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://fonts.googleapis.com https://fonts.gstatic.com https://vitals.vercel-analytics.com https://va.vercel-scripts.com https://*.vercel-insights.com https://*.hsappstatic.net chrome-extension: moz-extension:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https: http:",
              "media-src 'self' data: blob: https: http:",
              "connect-src 'self' https://www.google.com https://vitals.vercel-analytics.com https://va.vercel-scripts.com https://*.vercel-insights.com https://api.cloudinary.com https://*.hsappstatic.net chrome-extension: moz-extension:",
              "frame-src 'self' https://www.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join("; ")
          },
          // Add additional security headers
          {
            key: "X-DNS-Prefetch-Control",
            value: "on"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block"
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin"
          }
        ]
      }
    ];
  },
  // External packages for server components
  serverExternalPackages: [],
  // Add experimental features for better performance and compatibility
  experimental: {
    scrollRestoration: true
  },
  // Configure how external resources are handled
  images: {
    domains: ['res.cloudinary.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  }
};

export default nextConfig;
