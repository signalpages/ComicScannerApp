
import React from 'react';
import CoverImage from '../CoverImage';

const VerifyView = ({ image, candidates, onSelect, onRetake }) => {
    // If no scan image is provided, we are in manual lookup mode
    const isManual = !image;
    const logoFallback = isManual ? "/pwa-512x512.png" : null;

    return (
        <div className="h-full flex flex-col bg-midnight-950 p-4">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Verify Match</h2>

            {/* Captured Image Preview */}
            <div className="flex justify-center mb-6">
                <div className="w-32 h-48 border-2 border-neon-blue rounded-lg overflow-hidden relative shadow-neon bg-black">
                    <CoverImage
                        src={image}
                        fallbackSrc={logoFallback}
                        size="lg"
                        className="w-full h-full object-cover"
                        alt="Scan"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-center text-white py-1">YOUR SCAN</div>
                </div>
            </div>

            <h3 className="text-sm text-gray-400 uppercase font-bold mb-2">Select Best Match:</h3>

            {(candidates && candidates.length > 0) ? (
                <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                    {candidates.map((cand) => (
                        <div
                            key={cand.editionId}
                            onClick={() => onSelect(cand)}
                            className="flex items-center gap-4 p-3 bg-white/5 border border-white/10 rounded-xl active:bg-white/10"
                        >
                            <div className="w-16 h-24 rounded bg-gray-800 overflow-hidden flex-shrink-0">
                                <CoverImage
                                    src={cand.coverUrl}
                                    fallbackSrc={logoFallback}
                                    size="sm"
                                    className="w-full h-full object-cover"
                                    alt="Cover"
                                />
                            </div>
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
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <p className="mb-4">No matches found.</p>
                </div>
            )}

            <button onClick={onRetake} className="mt-2 py-3 text-gray-400 text-sm font-bold">
                None of these? Retake
            </button>
        </div>
    );
};

export default VerifyView;
