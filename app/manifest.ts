import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Comic Scanner AI',
        short_name: 'ComicScan',
        description: 'Scan and value your comic books instantly',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0a12',
        theme_color: '#0a0a12',
        icons: [
            {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: '/apple-touch-icon.png',
                sizes: '180x180',
                type: 'image/png'
            }
        ],
    }
}
