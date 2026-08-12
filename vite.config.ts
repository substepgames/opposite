import { defineConfig, loadEnv } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig(({ mode }) => ({
    plugins: [solidPlugin()],
    define: {
        wslobbyUrl: JSON.stringify(loadEnv(mode, process.cwd(), '').WSLOBBY_URL)
    },
    server: {
        port: 3000
    },
    build: {
        target: 'esnext'
    }
}))
