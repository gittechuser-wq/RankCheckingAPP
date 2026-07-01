import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/aliyan-api": {
        target: "https://aliyanpharma.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aliyan-api/, ""),
      },
      "/seo-api": {
        target: "http://localhost:8788",
        changeOrigin: true,
      },
    },
  },
});
