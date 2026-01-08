
import React from 'react';

const VerifyView = ({ image, candidates, onSelect, onRetake }) => {
    const getProxyUrl = (url) => {
        if (!url) return null;

        // allow local assets and data URLs
        if (url.startsWith("data:")) return url;
        if (url.startsWith("/")) {
            const looksLikeImage = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url);
            return looksLikeImage ? url : null;
        }

        // only proxy absolute http(s)
        if (/^https?:\/\//i.test(url)) {
            return `/api/proxy-image?url=${encodeURIComponent(url)}`;
        }

        return null;
    };

    return (
        <div className="h-full flex flex-col bg-midnight-950 p-4">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Verify Match</h2>

            {/* Captured Image Preview */}
            <div className="flex justify-center mb-6">
                <div className="w-32 h-48 border-2 border-neon-blue rounded-lg overflow-hidden relative shadow-neon">
                    <img src={image} className="w-full h-full object-cover" alt="Scan" />
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-center text-white py-1">YOUR SCAN</div>
                </div>
            </div>

            <h3 className="text-sm text-gray-400 uppercase font-bold mb-2">Select Best Match:</h3>

            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {candidates.map((cand) => (
                    <div
                        key={cand.editionId}
                        onClick={() => onSelect(cand)}
                        className="flex items-center gap-4 p-3 bg-white/5 border border-white/10 rounded-xl active:bg-white/10"
                    >
                        <img src={getProxyUrl(cand.coverUrl)} className="w-16 h-24 object-cover rounded bg-gray-800" alt="Cover" />
                        <div className="flex-1">
                            <h4 className="font-bold text-white leading-tight">{cand.displayName}</h4>
                            <p className="text-xs text-gray-400 mt-1">{cand.variantHint || 'Standard Cover'}</p>
                            {cand.year && <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300 mt-2 inline-block">{cand.year}</span>}
                        </div>
                        <div className="text-neon-blue">
                            ➜
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={onRetake} className="mt-2 py-3 text-gray-400 text-sm font-bold">
                None of these? Retake
            </button>
        </div>
    );
};

export default VerifyView;
