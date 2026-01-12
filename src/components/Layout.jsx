import React from 'react';

const Layout = ({ children, currentView, onViewChange }) => {
    return (
        <div className="flex flex-col h-screen bg-midnight-900 text-white overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-midnight-800/90 backdrop-blur-md border-b border-white/5 z-10 safe-top">
                <h1 className="text-xl font-bold bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
                    ComicScan AI
                </h1>
                <div className="flex gap-2">
                    {/* Simple indicators or settings icon could go here */}
                    <div className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 relative overflow-y-auto">
                {children}
            </main>

            {/* Bottom Navigation */}
            {/* Bottom Navigation Removed per User Request (Option A) */}
        </div>
    );
};

export default Layout;
