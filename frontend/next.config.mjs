// \microai-frontend\next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/users/media/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    loader: 'custom',
    loaderFile: './image_loader.js',
  },
  distDir: '.next',
  sassOptions: {
    includePaths: ['./src/styles'],
  }
};

export default nextConfig;
