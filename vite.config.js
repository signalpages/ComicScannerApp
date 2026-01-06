import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Comic Scanner AI',
        short_name: 'ComicScan',
        description: 'Scan and value your comic books instantly',
        theme_color: '#0a0a12',
        background_color: '#0a0a12',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    proxy: {
      '/api/comicvine': {
        target: 'https://comicvine.gamespot.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/comicvine/, '')
      }
    }
  }
})
