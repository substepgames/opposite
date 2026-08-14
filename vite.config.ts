import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
    plugins: [solidPlugin()],
    define: {
        wslobbyUrl: JSON.stringify(process.env.WSLOBBY_URL)
    },
    server: {
        port: 3000
    },
    build: {
        target: 'esnext'
    }
})
