import React from 'react';

const ResultCard = ({ data, onRescan }) => {
    if (!data) return null;

    const { aiData, pricingData, imageBlob } = data;
    const initialImageUrl = imageBlob ? URL.createObjectURL(imageBlob) : null;

    // State to track selected variant (defaults to initial scan/search result)
    const [selectedVariant, setSelectedVariant] = React.useState(null);

    // Derived values based on selection
    const activePricing = selectedVariant ? selectedVariant : pricingData;
    const activeImage = selectedVariant ? selectedVariant.image : initialImageUrl;
    const activeTitle = selectedVariant ? selectedVariant.name : (aiData.condition_estimate || 'Raw');

    const showRawDisclaimer = activePricing.price_raw > 20 && !aiData.is_key_issue;

    return (
        <div className="h-full flex flex-col p-4 overflow-y-auto">

            {/* Variant Selector (Horizontal List) */}
            {pricingData.variants && pricingData.variants.length > 0 && (
                <div className="mb-6">
                    <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-3 pl-1">Select Variant</p>
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar px-1">
                        {/* Original Scan Option */}
                        <div
                            onClick={() => setSelectedVariant(null)}
                            className={`flex-shrink-0 w-24 h-36 relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 border-2 ${selectedVariant === null ? 'border-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.3)]' : 'border-transparent opacity-70 hover:opacity-100'}`}
                        >
                            <img src={initialImageUrl || '/default_cover.png'} alt="Original" className="w-full h-full object-cover" />
                            {/* Frosted Glass Overlay */}
                            <div className="absolute bottom-0 inset-x-0 bg-white/10 backdrop-blur-md border-t border-white/20 p-1.5 flex justify-center">
                                <span className="text-[10px] font-bold text-white tracking-wider">YOUR SCAN</span>
                            </div>
                        </div>

                        {/* Variants from API */}
                        {pricingData.variants.map((variant, idx) => (
                            <div
                                key={idx}
                                onClick={() => setSelectedVariant(variant)}
                                className={`flex-shrink-0 w-24 h-36 relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 border-2 ${selectedVariant === variant ? 'border-neon-purple shadow-[0_0_15px_rgba(188,19,254,0.3)]' : 'border-transparent opacity-70 hover:opacity-100'}`}
                            >
                                <img src={variant.image || '/default_cover.png'} alt={variant.name} className="w-full h-full object-cover" />
                                {/* Frosted Glass Overlay */}
                                <div className="absolute bottom-0 inset-x-0 bg-white/10 backdrop-blur-md border-t border-white/20 p-1.5 flex justify-center">
                                    <span className="text-[14px] font-display font-bold text-white drop-shadow-md">{variant.cover_letter || 'VAR'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bento Grid Container */}
            <div className="grid grid-cols-2 gap-4 auto-rows-min flex-1">

                {/* Hero Block: Main Cover Display (Dynamic based on selection) */}
                <div className="col-span-2 glass-panel p-4 rounded-3xl flex justify-center items-center relative overflow-hidden group transition-all duration-500 hover:shadow-neon-blue/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 max-w-[180px] transition-transform duration-300 hover:scale-[1.02]">
                        {/* Skeleton Loader Effect logic handled by image lazy loading usually, simplified here with fallback */}
                        <img
                            src={activeImage || '/default_cover.png'}
                            alt="Active Cover"
                            className="w-full h-auto object-cover min-h-[250px] bg-white/5 animate-pulse-slow"
                            onLoad={(e) => e.target.classList.remove('animate-pulse-slow')}
                        />
                        <div className="absolute top-2 right-2 px-3 py-1 bg-neon-purple/90 backdrop-blur-md rounded-full text-xs font-bold text-white shadow-lg border border-white/20">
                            {activeTitle}
                        </div>
                    </div>
                </div>

                {/* Title Block */}
                <div className="col-span-2 glass-panel p-5 rounded-3xl flex flex-col justify-center text-center border-l-4 border-l-neon-blue hover:bg-white/5 transition-colors">
                    <h2 className="text-3xl font-display font-bold text-white leading-none mb-1">
                        {aiData.title} <span className="text-neon-blue">#{aiData.issue_number}</span>
                    </h2>
                    <p className="text-gray-400 text-sm font-body font-medium uppercase tracking-wide">
                        {aiData.publisher || pricingData.publisher || 'Unknown'} • {aiData.year || (pricingData.cover_date ? pricingData.cover_date.split('-')[0] : '????')}
                    </p>
                    {aiData.is_variant && !selectedVariant && (
                        <div className="mt-2 inline-flex self-center px-3 py-1 rounded-lg bg-neon-pink/20 border border-neon-pink/30 text-neon-pink text-[10px] font-bold uppercase tracking-wider">
                            {aiData.variant_name}
                        </div>
                    )}
                </div>

                {/* Price Block: Raw */}
                <div className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden active:scale-95 transition-transform duration-200">
                    <span className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-1">Raw Value</span>
                    <span className="text-3xl font-display font-bold text-neon-blue drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]">
                        {activePricing.values?.raw || (activePricing.price_raw ? `$${activePricing.price_raw} .00` : '$-')}
                    </span>
                    {showRawDisclaimer && (
                        <div className="mt-2 px-2 py-1 bg-white/5 rounded text-[9px] text-center text-gray-300 leading-tight">
                            High Grade Est.<br /><span className="text-red-300">Check eBay</span>
                        </div>
                    )}
                </div>

                {/* Price Block: Graded */}
                <div className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden active:scale-95 transition-transform duration-200">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-neon-purple/20 blur-2xl rounded-full" />
                    <span className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-1">CGC 9.8</span>
                    <span className="text-3xl font-display font-bold text-neon-purple drop-shadow-[0_0_10px_rgba(188,19,254,0.3)]">
                        {activePricing.values?.cgc_9_8 || (activePricing.price_graded ? `$${activePricing.price_graded} .00` : '$-')}
                    </span>
                </div>

                {/* Action Blocks */}
                <button className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center hover:bg-white/10 transition-colors group active:scale-95">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-300 group-hover:text-white mb-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <span className="text-[10px] font-bold text-gray-300 group-hover:text-white uppercase tracking-wide">Save</span>
                </button>

                <a
                    href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${aiData.title} ${aiData.issue_number} ${selectedVariant ? selectedVariant.name : ''}`)} -cgc -cbcs&_sop=12`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-panel p-4 rounded-3xl flex flex-col items-center justify-center bg-blue-600/20 hover:bg-blue-600/40 border-blue-500/30 transition-all group cursor-pointer active:scale-95"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-300 group-hover:text-white mb-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-[10px] font-bold text-blue-300 group-hover:text-white uppercase tracking-wide">eBay</span>
                </a >

            </div >

            <button onClick={onRescan} className="mt-6 mx-auto px-8 py-3 rounded-full glass-panel hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-all pb-safe hover:scale-105 active:scale-95">
                Scan Next Comic
            </button>
        </div >
    );
};

export default ResultCard;
