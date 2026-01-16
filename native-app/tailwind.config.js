/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ['var(--font-display)'],
                body: ['var(--font-body)'],
            },
            colors: {
                midnight: {
                    900: '#05050A',
                    800: '#0F0F1A',
                    950: '#020205', // Added for safety if used
                },
                'neon-blue': '#00f3ff',
                'neon-pink': '#ff00ff',
                'neon-purple': '#bc13fe',
                'glass-border': 'var(--color-glass-border)',
                'glass-bg': 'var(--color-glass-bg)',
            },
            boxShadow: {
                'neon': '0 0 10px rgba(0, 243, 255, 0.5), 0 0 20px rgba(0, 243, 255, 0.3)',
            }
        },
    },
    plugins: [],
}
