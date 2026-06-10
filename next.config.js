/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // کانکتورهای آزمایشی wagmi که استفاده نمی‌کنیم و build را می‌شکنند
    config.resolve.alias = {
      ...config.resolve.alias,
      "porto/internal": false,
      "porto": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
