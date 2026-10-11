import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(function (_a) {
    var _b;
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    return {
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        plugins: [react()],
        server: {
            host: "0.0.0.0",
            port: 5173,
            proxy: {
                "/api": {
                    target: (_b = env.VITE_API_PROXY_TARGET) !== null && _b !== void 0 ? _b : "http://localhost:8000",
                    changeOrigin: true,
                },
            },
        },
        build: {
            outDir: "dist",
            sourcemap: false,
        },
    };
});
