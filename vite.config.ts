import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",     // ⬅ normal output
    assetsDir: "assets" // ⬅ prevent weird "public" folder nesting
  }
});
