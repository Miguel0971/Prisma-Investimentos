import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pdfjs-dist", "exceljs"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Content-Security-Policy",
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://blob.vercel-storage.com https://*.blob.vercel-storage.com https://*.vercel-storage.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
                },
              ]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};
export default config;
