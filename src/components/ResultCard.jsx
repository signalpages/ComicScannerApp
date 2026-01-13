import React, { useState } from "react";
import CoverImage from "./CoverImage";

const formatRange = (min, max) => {
  if (!min || !max || isNaN(min) || isNaN(max)) return "$-";
  return `$${Math.trunc(min)} – $${Math.trunc(max)}`;
};

const sanitizeIssue = (issue) =>
  issue && /^\d+$/.test(String(issue)) ? Number(issue) : null;

const ResultCard = ({ data, onRescan }) => {
  if (!data) return null;

  const { aiData = {}, pricingData = {}, scanImage } = data;

  // Confidence determination
  const matchConfidence = aiData.confidence || pricingData.confidence || 0.8;
  const coverConfidence = pricingData.coverConfidence || "HIGH";

  const isMatchHigh = matchConfidence > 0.7;
  const isCoverGood = coverConfidence === "HIGH";

  // Use High Confidence UI only if match is high. Cover issues are handled separately.
  const isHighConfidence = isMatchHigh;

  const [selectedVariant, setSelectedVariant] = useState(null);

  const issueNum = sanitizeIssue(aiData.issue_number);
  const activePricing = selectedVariant || pricingData;

  const activeImage =
    scanImage ||                      // 1. User's photo (Highest priority)
    pricingData.coverUrl ||           // 2. Canonical cover
    data.ebay?.imageUrl ||            // 3. Live eBay result (if fresh scan)
    pricingData.marketImageUrl ||     // 4. Stored eBay image (history)
    null;

  const activeItemUrl = data.ebay?.itemUrl;

  const ebayQuery = [
    aiData.title,
    issueNum ? `#${issueNum}` : null,
    selectedVariant?.name
  ]
    .filter(Boolean)
    .join(" ");

  // Derived Range Logic
  // Use poor (25%) and nearMint (75%) as the primary market range
  const priceLow = activePricing?.values?.poor ?? activePricing?.poor ?? 0;
  const priceHigh = activePricing?.values?.nearMint ?? activePricing?.nearMint ?? 0;
  const priceTypical = activePricing?.values?.typical ?? activePricing?.typical ?? 0;

  // Fallback for "thin data" if range is inverted or zero
  const hasValidPricing = priceHigh > 0;

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      {/* Confidence Label */}
      <div className="flex flex-col items-center justify-center mb-2 gap-1">
        <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full ${isMatchHigh ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
          Match Confidence: {isMatchHigh ? 'High' : 'Possible Match'}
        </span>
        {!isCoverGood && !scanImage && (
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Cover Image Unavailable</span>
        )}
      </div>

      {/* Variant Selector */}
      {Array.isArray(pricingData.variants) &&
        pricingData.variants.length > 0 && (
          <div className="mb-6">
            <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-3 pl-1">
              Select Variant
            </p>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar px-1">
              <div
                onClick={() => setSelectedVariant(null)}
                className={`flex-shrink-0 w-24 h-36 relative rounded-xl overflow-hidden cursor-pointer border-2 ${!selectedVariant
                  ? "border-neon-blue shadow-neon"
                  : "border-transparent opacity-70"
                  }`}
              >
                <CoverImage
                  src={scanImage}
                  size="md"
                  className="w-full h-full object-cover"
                  alt="Your scan"
                />
                <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[10px] text-center py-1">
                  YOUR SCAN
                </div>
              </div>

              {pricingData.variants.map((variant, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedVariant(variant)}
                  className={`flex-shrink-0 w-24 h-36 relative rounded-xl overflow-hidden cursor-pointer border-2 ${selectedVariant === variant
                    ? "border-neon-purple"
                    : "border-transparent opacity-70"
                    }`}
                >
                  <CoverImage
                    src={variant.image}
                    size="md"
                    className="w-full h-full object-cover"
                    alt={variant.name}
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-sm text-center py-1">
                    {variant.cover_letter || "VAR"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Cover */}
      <div className="flex justify-center mb-6">
        <CoverImage
          src={activeImage}
          fallbackSrc={!scanImage ? "/pwa-512x512.png" : null}
          size="xl"
          alt="Comic cover"
          className="max-w-[180px] rounded-xl shadow-lg"
        />
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white">
          {aiData.title}
          {issueNum && (
            <span className="text-neon-blue ml-2">#{issueNum}</span>
          )}
        </h2>
        <p className="text-gray-400 text-sm uppercase tracking-wide">
          {aiData.publisher || pricingData.publisher || "Unknown"} •{" "}
          {aiData.year ||
            (pricingData.cover_date
              ? pricingData.cover_date.split("-")[0]
              : "—")}
        </p>

        {/* Key Issue Badge */}
        {isHighConfidence && aiData.is_key_issue && (
          <p className="text-yellow-400 text-xs mt-2 font-bold">★ KEY ISSUE</p>
        )}
      </div>

      {/* Market Value Section */}
      {isHighConfidence && hasValidPricing ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-white font-bold text-lg">Market Value</h3>
            <span className="text-gray-500 text-xs">(Recent Sales)</span>
          </div>

          <div className="glass-panel p-5 rounded-3xl">
            {/* Primary Range */}
            <div className="text-center mb-4">
              <span className="text-gray-400 text-xs uppercase tracking-widest">Est. Market Range</span>
              <div className="text-4xl text-white font-black mt-1 tracking-tight">
                {formatRange(priceLow, priceHigh)}
              </div>
            </div>

            {/* Grade Bands */}
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
              <div className="text-center border-r border-white/10">
                <p className="text-gray-500 text-[10px] uppercase font-bold">CGC 9.0 – 9.2</p>
                <p className="text-neon-blue font-bold text-lg mt-1">
                  {formatRange(priceTypical, priceHigh)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-[10px] uppercase font-bold">CGC 9.8</p>
                <p className="text-neon-purple font-bold text-lg mt-1">
                  {priceHigh > 200 ? formatRange(priceHigh, priceHigh * 1.5) : "Premium"}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 glass-panel p-6 rounded-3xl text-center">
          <p className="text-gray-300 font-bold mb-2">Pricing Unavailable</p>
          <p className="text-gray-500 text-sm">
            {isHighConfidence
              ? "Not enough recent sales data to estimate value."
              : "Low confidence match. Please verify title or rescan."}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <a
          href={activeItemUrl || `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
            ebayQuery
          )}&_sop=12&LH_Sold=1&LH_Complete=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-panel p-4 rounded-3xl text-center text-blue-300 hover:text-white font-bold"
        >
          View Recent Sales
        </a>

        <button
          onClick={onRescan}
          className="glass-panel p-4 rounded-3xl text-center text-white font-bold"
        >
          Scan Next
        </button>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-[10px] text-gray-600 px-4 leading-tight">
        Values reflect recent public sales and vary by condition, grading, and market demand.
      </p>
    </div>
  );
};

export default ResultCard;
