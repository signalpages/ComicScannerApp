import React from 'react';

const Layout = ({ children, currentView, onViewChange }) => {
    return (
        <div className="flex flex-col h-screen bg-midnight-900 text-white overflow-hidden">
            {/* Header Removed per User Request (Clean UI - App Bar gone, Hero Header stays in Home) */}

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
