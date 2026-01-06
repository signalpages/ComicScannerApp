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
            <nav className="flex justify-around items-center bg-midnight-800/90 backdrop-blur-md border-t border-white/5 pb-safe py-3 z-10">
                <button
                    onClick={() => onViewChange('scan')}
                    className={`flex flex-col items-center p-2 rounded-lg transition-colors ${currentView === 'scan' ? 'text-neon-blue' : 'text-gray-400'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                    <span className="text-xs mt-1">Scan</span>
                </button>

                <button
                    onClick={() => onViewChange('manual')}
                    className={`flex flex-col items-center p-2 rounded-lg transition-colors ${currentView === 'manual' ? 'text-neon-purple' : 'text-gray-400'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-xs mt-1">Search</span>
                </button>
            </nav>
        </div>
    );
};

export default Layout;
