import React from "react";

const Toast = ({ message, type = "info" }) => {
    if (!message) return null;

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] max-w-[90vw] animate-slide-up-fade">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
                {type === "success" && <span className="text-green-400">✓</span>}
                {type === "error" && <span className="text-red-400">✕</span>}
                <span className="font-medium text-sm">{message}</span>
            </div>
        </div>
    );
};

export default Toast;
