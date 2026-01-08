
import "./globals.css";

export const metadata = {
    title: "Comic Scanner AI",
    description: "Scan and value your comic books instantly",
    manifest: "/manifest.webmanifest",
    viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
    themeColor: "#0a0a12",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Orbitron:wght@400;700&display=swap" rel="stylesheet" />
            </head>
            <body>
                <div id="root" className="h-[100dvh] w-full overflow-hidden">
                    {children}
                </div>
            </body>
        </html>
    );
}
