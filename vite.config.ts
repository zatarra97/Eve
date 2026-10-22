import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Leggi la versione dal package.json
const packageJson = JSON.parse(readFileSync("./package.json", "utf8"))

// https://vite.dev/config/
export default defineConfig({
	base: process.env.VITE_BASE_PATH || "/",
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	build: {
		outDir: "build",
	},
	define: {
		__APP_VERSION__: JSON.stringify(packageJson.version),
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
})
