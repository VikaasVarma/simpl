import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: process.env.PUBLISHED_BUILD === "1" ? "dist" : ".local-build",
  },
});
