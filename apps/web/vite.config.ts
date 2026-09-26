import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [reactRouter()],
  resolve: {
    alias: { "react-native": "react-native-web" },
    dedupe: ["react", "react-dom", "react-native-web"],
    tsconfigPaths: true,
  },
  ssr: { optimizeDeps: { include: ["react-native-web"] } },
});
