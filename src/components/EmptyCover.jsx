import React from 'react';

const EmptyCover = ({ text = "No Cover", size = "md", className = "", src = null }) => {
    const sizeClasses = {
        sm: "w-16 h-24 text-[8px]",
        md: "w-24 h-36 text-[10px]",
        lg: "w-32 h-48 text-xs",
        xl: "max-w-[180px] h-[270px] text-sm" // Matches ResultCard hero
    };

    if (src) {
        return (
            <div className={`flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-lg overflow-hidden ${sizeClasses[size] || sizeClasses.md} ${className}`}>
                <img src={src} className="w-full h-full object-contain opacity-50 p-2" alt="Placeholder" />
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-lg text-gray-500 font-bold uppercase tracking-widest ${sizeClasses[size] || sizeClasses.md} ${className}`}>
            <div className="mb-2 opacity-50">
                📷
            </div>
            <span>{text}</span>
        </div>
    );
};

export default EmptyCover;
