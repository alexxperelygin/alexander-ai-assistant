import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma client must stay external in server components
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
