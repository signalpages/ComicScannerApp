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

  // CS-018: Build eBay Sold Query
  // Format: "Series Title #IssueNumber comic" (+ "CGC" if graded?)
  // We want strict sold listings.
  const ebayQueryComponents = [aiData.title];
  if (issueNum) ebayQueryComponents.push(`#${issueNum}`);
  ebayQueryComponents.push("comic");

  // Clean up
  const ebayQuery = ebayQueryComponents.join(" ");

  // CS-018: URL Construction
  // https://www.ebay.com/sch/i.html?_nkw=...&LH_Sold=1&LH_Complete=1
  const recentSalesUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(ebayQuery)}&LH_Sold=1&LH_Complete=1`;

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">

      {/* Cover */}
      <div className="flex justify-center mb-4 mt-4">
        <CoverImage
          src={activeImage}
          fallbackSrc={!scanImage ? "/placeholder-cover.png" : null}
          size="xl"
          alt="Comic cover"
          className="max-w-[180px] rounded-xl shadow-lg border-[3px] border-white/10"
        />
      </div>

      {/* CS-016: Confidence Badge Moved Below Cover */}
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

      {/* CS-017: Removed Pricing UI Entirely */}

      {/* Actions */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        {/* CS-018: View Recent Sales (Real Link) */}
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
        Redirects to eBay sold listings for live market data.
      </p>
    </div>
  );
};

export default ResultCard;
