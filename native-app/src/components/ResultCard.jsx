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
  const isMatchHigh = matchConfidence > 0.7;

  // Use High Confidence UI only if match is high.
  const isHighConfidence = isMatchHigh;

  const [selectedVariant, setSelectedVariant] = useState(null);

  const issueNum = sanitizeIssue(aiData.issue_number);

  const activeImage =
    scanImage ||                      // 1. User's photo (Highest priority)
    pricingData.coverUrl ||           // 2. Canonical cover
    data.ebay?.imageUrl ||            // 3. Live eBay result (if fresh scan)
    pricingData.marketImageUrl ||     // 4. Stored eBay image (history)
    null;

  // CS-025: Pricing State (Non-blocking Flow)
  // If "result" exists in pricingData, use it. Otherwise assume null.
  // Note: CS-033 History Item might pass pricing in slightly different shape, handle both.
  const pricingResult = pricingData.result || pricingData.pricing || null;
  // If pricingData.price_raw exists, it came from history simple shape.
  const directPrice = pricingData.price_raw || pricingData.value?.typical;

  const isLoadingPrice = pricingResult === null && !directPrice;
  const priceValue = directPrice || pricingResult?.value?.typical;
  const isPriceAvailable = priceValue != null;
  const priceSourceType = pricingResult?.value?.soft ? 'recent sales' : 'active listings';

  // CS-028: Build eBay Sold Query
  const queryTitle = aiData.title || "";
  const queryIssue = issueNum;

  const ebayQueryComponents = [queryTitle];
  if (queryIssue) ebayQueryComponents.push(`#${queryIssue}`);
  ebayQueryComponents.push("comic");

  const ebayQuery = ebayQueryComponents.join(" ");
  const recentSalesUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(ebayQuery)}&LH_Sold=1&LH_Complete=1`;

  // CS-034: Safe Area Padding
  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto pt-safe">

      {/* Cover */}
      <div className="flex justify-center mb-4 mt-8">
        <CoverImage
          src={activeImage}
          fallbackSrc={!scanImage ? "/placeholder-cover.png" : null}
          size="xl"
          alt="Comic cover"
          className={`max-w-[180px] rounded-xl shadow-lg border-[3px] border-white/10 ${isLoadingPrice ? 'animate-pulse' : ''}`}
        />
      </div>

      {/* CS-034: Confidence Badge Moved Below Cover */}
      <div className="flex flex-col items-center justify-center mb-6 gap-1">
        <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full border ${isMatchHigh
          ? 'bg-green-500/10 text-green-400 border-green-500/30'
          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
          }`}>
          Match Confidence: {isMatchHigh ? 'High' : 'Possible Match'}
        </span>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white leading-tight">
          {aiData.title}
          {issueNum && (
            <span className="text-neon-blue ml-2">#{issueNum}</span>
          )}
        </h2>
        <p className="text-gray-400 text-sm uppercase tracking-wide mt-2">
          {aiData.publisher || pricingData.publisher || "Unknown"} •{" "}
          {aiData.year ||
            (pricingData.cover_date
              ? pricingData.cover_date.split("-")[0]
              : "—")}
        </p>

        {/* Key Issue Badge */}
        {isHighConfidence && aiData.is_key_issue && (
          <p className="text-yellow-400 text-xs mt-3 font-bold bg-yellow-400/10 inline-block px-2 py-1 rounded">★ KEY ISSUE</p>
        )}
      </div>

      {/* CS-025: Pricing / Value Display */}
      <div className="mb-8">
        {isLoadingPrice ? (
          <div className="text-center animate-pulse">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Checking Value...</p>
            <div className="h-8 w-32 bg-white/10 rounded mx-auto"></div>
          </div>
        ) : isPriceAvailable ? (
          <div className="text-center">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Estimated Value</p>
            <div className="text-5xl font-black text-white tracking-tighter drop-shadow-neon">
              ${priceValue}
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Based on {priceSourceType}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Pricing Unavailable</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        {/* CS-028: View Recent Sales (Real Link) */}
        <a
          href={recentSalesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl shadow-lg text-white font-bold text-center active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <span>💰</span> VIEW RECENT SALES
        </a>

        <button
          onClick={onRescan}
          className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold text-center active:bg-white/10"
        >
          Scan Next
        </button>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-[10px] text-gray-600 px-4 leading-tight mt-4">
        Values are estimates based on "best guess" market data. Always verify with actual sales.
      </p>
    </div>
  );
};

export default ResultCard;
