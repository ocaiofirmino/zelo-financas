import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";

const here = fileURLToPath(new URL(".", import.meta.url));
const repository = fileURLToPath(new URL("..", import.meta.url));
const demoPackages = [
  "react",
  "react-dom",
  "lucide-react",
  "radix-ui",
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
  "exceljs",
  "tailwindcss",
  "tw-animate-css",
];

export default defineConfig({
  root: here,
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [
      { find: "next/link", replacement: fileURLToPath(new URL("src/link.tsx", import.meta.url)) },
      { find: "@", replacement: repository },
      // Código compartilhado usa apenas as dependências instaladas nesta demo.
      ...demoPackages.map((name) => ({
        find: name,
        replacement: fileURLToPath(new URL(`node_modules/${name}`, import.meta.url)),
      })),
    ],
    dedupe: ["react", "react-dom"],
  },
  css: {
    postcss: { plugins: [tailwindcss({ base: here })] },
  },
  server: { fs: { allow: [repository] } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
