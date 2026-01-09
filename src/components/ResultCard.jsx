import React, { useState } from "react";

const formatPrice = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? `$${Math.trunc(value)}`
    : "$-";

const sanitizeIssue = (issue) =>
  issue && /^\d+$/.test(String(issue)) ? Number(issue) : null;

const ResultCard = ({ data, onRescan }) => {
  if (!data) return null;

  const { aiData = {}, pricingData = {}, scanImage } = data;

  const getProxyUrl = (url) => {
    if (!url) return null;

    // allow local assets and data URLs
    if (url.startsWith("data:")) return url;
    if (url.startsWith("/")) {
      // local file must actually be an image asset you host
      // if it's just a filename-ish thing, don't try to load it
      const looksLikeImage = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url);
      return looksLikeImage ? url : null;
    }

    // only proxy absolute http(s)
    if (/^https?:\/\//i.test(url)) {
      return `/api/image?url=${encodeURIComponent(url)}`;
    }

    // anything else (e.g. "3143431-cm01.jpg") -> treat as missing
    return null;
  };

  const [selectedVariant, setSelectedVariant] = useState(null);

  const issueNum = sanitizeIssue(aiData.issue_number);

  const activePricing = selectedVariant || pricingData;

  const activeImage =
    pricingData.coverUrl ||
    scanImage ||
    "/default_cover.png";

  const ebayQuery = [
    aiData.title,
    issueNum ? `#${issueNum}` : null,
    selectedVariant?.name
  ]
    .filter(Boolean)
    .join(" ");

  const showRawDisclaimer =
    activePricing?.price_raw > 20 && !aiData?.is_key_issue;

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">

      {/* Variant Selector */}
      {Array.isArray(pricingData.variants) &&
        pricingData.variants.length > 0 && (
          <div className="mb-6">
            <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-3 pl-1">
              Select Variant
            </p>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar px-1">
              {/* Original Scan */}
              <div
                onClick={() => setSelectedVariant(null)}
                className={`flex-shrink-0 w-24 h-36 relative rounded-xl overflow-hidden cursor-pointer border-2 ${!selectedVariant
                  ? "border-neon-blue shadow-neon"
                  : "border-transparent opacity-70"
                  }`}
              >
                <img
                  src={scanImage || "/default_cover.png"}
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
                  <img
                    src={getProxyUrl(variant.image) || "/default_cover.png"}
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
        <img
          src={activeImage}
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
      </div>

      {/* Prices */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="glass-panel p-4 rounded-3xl text-center">
          <span className="text-gray-400 text-xs uppercase">Raw</span>
          <div className="text-3xl text-neon-blue font-bold">
            {formatPrice(
              activePricing?.values?.raw ?? activePricing?.price_raw
            )}
          </div>
          {showRawDisclaimer && (
            <div className="text-[10px] text-gray-300 mt-2">
              High grade est. — check eBay
            </div>
          )}
        </div>

        <div className="glass-panel p-4 rounded-3xl text-center">
          <span className="text-gray-400 text-xs uppercase">CGC 9.8</span>
          <div className="text-3xl text-neon-purple font-bold">
            {formatPrice(
              activePricing?.values?.cgc_9_8 ??
              activePricing?.price_graded
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <a
          href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
            ebayQuery
          )}&_sop=12`}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-panel p-4 rounded-3xl text-center text-blue-300 hover:text-white"
        >
          eBay
        </a>

        <button
          onClick={onRescan}
          className="glass-panel p-4 rounded-3xl text-center text-white"
        >
          Scan Next
        </button>
      </div>
    </div>
  );
};

export default ResultCard;
