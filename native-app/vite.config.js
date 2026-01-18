import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import packageJson from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    define: {
        'process.env.BUILD_TIMESTAMP': JSON.stringify(new Date().toISOString()),
        'process.env.APP_VERSION': JSON.stringify(packageJson.version),
    }
})

