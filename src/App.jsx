import React, { useMemo, useEffect, useState } from "react";
import Layout from "./components/Layout";
import CameraView from "./components/CameraView";
import ResultCard from "./components/ResultCard";
import CoverImage from "./components/CoverImage";
import ManualView from "./components/views/ManualView";
import VerifyView from "./components/views/VerifyView";
import { useScanFlow, SCAN_STATE } from "./hooks/useScanFlow";
import { IAP } from "./services/iapBridge";

function App() {
  const {
    state,
    error,
    capturedImage,
    candidates,
    selectedCandidate,
    pricingResult,
    quotaStatus,
    actions
  } = useScanFlow();

  // History (read from local storage for Home view)
  // History (read from local storage for Home view)
  const [historyVersion, setHistoryVersion] = useState(0);
  const history = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('scanHistory') || '[]');
    } catch { return []; }
  }, [state, historyVersion]); // Re-read on state change or manual version bump

  const clearHistory = () => {
    if (!confirm("Clear all scan history?")) return;
    localStorage.removeItem("scanHistory");
    setHistoryVersion(v => v + 1);
    actions.resetFlow();
  };

  const deleteHistoryItem = (itemToDelete) => {
    if (!confirm(`Delete scan "${itemToDelete.displayName}"?`)) return;
    const newH = history.filter(i => i.timestamp !== itemToDelete.timestamp);
    localStorage.setItem("scanHistory", JSON.stringify(newH));
    setHistoryVersion(v => v + 1);
  };

  // -------------------------
  // Android Back Button Handling
  // -------------------------
  // -------------------------
  // Android Back Button Handling
  // -------------------------
  useEffect(() => {
    // If we ARE at home, replace state to anchor the history stack.
    if (state === SCAN_STATE.HOME) {
      window.history.replaceState({ view: "home" }, "");
    } else {
      // If we are NOT at home, push a state so the back button has something to pop
      window.history.pushState({ view: state }, "");
    }

    const handlePopState = (event) => {
      // If the back button was pressed and we are NOT at home, intercept and go Home
      if (state !== SCAN_STATE.HOME) {
        event.preventDefault(); // Hint to browser
        actions.resetFlow();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [state, actions]);


  const renderContent = () => {
    switch (state) {
      case SCAN_STATE.CAMERA:
        return <CameraView onCapture={actions.captureImage} />;

      case SCAN_STATE.CAPTURED:
      case SCAN_STATE.IDENTIFYING:
        return (
          <div className="h-full flex flex-col items-center justify-center bg-black/90 text-white pb-20">
            <div className="w-16 h-16 border-4 border-t-neon-blue border-r-transparent border-b-neon-purple border-l-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-lg font-bold animate-pulse text-neon-blue">IDENTIFYING...</p>
            <p className="text-sm text-gray-400 mt-2">Consulting the Oracle</p>
          </div>
        );

      case SCAN_STATE.VERIFY:
        return (
          <VerifyView
            image={capturedImage} // Pass captured image (could be null manual flow)
            candidates={candidates}
            onSelect={actions.confirmCandidate}
            onRetake={actions.startCamera}
          />
        );

      case SCAN_STATE.PRICING:
        return (
          <div className="h-full flex flex-col items-center justify-center bg-midnight-950 text-white">
            <div className="text-4xl mb-4">💰</div>
            <p className="text-xl font-bold text-neon-purple animate-pulse">VALUING...</p>
            <p className="text-sm text-gray-400 mt-2">Fetching comps from eBay</p>
          </div>
        );

      case SCAN_STATE.RESULT:
        return (
          <ResultCard
            data={{ // Mapping new data shape to old ResultCard props for minimal refactor
              aiData: {
                title: selectedCandidate?.seriesTitle || selectedCandidate?.displayName || 'Unknown',
                issue_number: selectedCandidate?.issueNumber || null,
                year: selectedCandidate?.year,
                publisher: selectedCandidate?.publisher
              },
              pricingData: {
                ...pricingResult?.value, // poor, typical, nearMint
                price_raw: pricingResult?.value?.typical,
                price_graded: pricingResult?.value?.nearMint,
                // Mapping: use coverUrl to match ResultCard expectation
                coverUrl: selectedCandidate?.coverUrl,
                marketImageUrl: selectedCandidate?.marketImageUrl,
                publisher: selectedCandidate?.publisher,
                cover_date: selectedCandidate?.year
              },
              scanImage: capturedImage // Pass base64 capture directly
            }}
            onRescan={actions.startCamera}
          />
        );

      case SCAN_STATE.LIMIT:
        return (
          <div className="h-full flex flex-col items-center justify-center bg-midnight-950 p-6 text-center">
            <div className="w-20 h-20 mb-6 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
              <span className="text-4xl">🛑</span>
            </div>
            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">Limit Reached</h2>
            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">Daily Limit Reached</h2>
            <p className="text-gray-400 mb-6 max-w-xs px-4">
              {quotaStatus?.message || "You have used your free auto-scans for today."}
              <br /><br />
              <span className="text-white font-bold">Manual Lookup is still free & unlimited.</span>
            </p>

            <div className="bg-white/5 rounded-xl p-4 w-full max-w-xs mb-8 border border-white/10">
              <div className="flex justify-between text-sm text-gray-300 mb-2 font-bold">
                <span>Free Scans Used</span>
                <span>{quotaStatus?.used || 5} / {quotaStatus?.limit || 5}</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 w-full"></div>
              </div>
              <p className="text-xs text-gray-500 mt-3 text-right">
                Resets on {quotaStatus?.resetAt ? new Date(quotaStatus.resetAt).toLocaleDateString() : 'next month'}
              </p>
            </div>

            <button
              onClick={() => IAP.purchaseMonthly()}
              className="w-full max-w-xs py-4 bg-gradient-to-r from-neon-blue to-blue-600 rounded-xl font-bold text-white shadow-neon mb-3 active:scale-95 transition-transform"
            >
              UPGRADE - $2.00 / MONTH
            </button>
            <button
              onClick={() => IAP.purchaseYearly()}
              className="w-full max-w-xs py-4 bg-white/10 text-white rounded-xl font-bold border border-white/10 active:bg-white/20 transition-colors"
            >
              Go Unlimited - $10.00 / YEAR
            </button>

            <button
              onClick={actions.startManualSearch}
              className="w-full max-w-xs py-4 bg-white/5 text-neon-blue font-bold rounded-xl border border-neon-blue/30 mt-3 active:bg-white/10"
            >
              Continue with Manual Lookup
            </button>

            <button onClick={actions.resetFlow} className="mt-6 text-gray-500 text-sm underline">
              Back to Home
            </button>
          </div>
        );

      case SCAN_STATE.MANUAL_SEARCH:
        return <ManualView onSearch={actions.performManualSearch} onCancel={actions.resetFlow} />;

      case SCAN_STATE.HOME:
      default:
        return (
          <div className="h-full flex flex-col bg-midnight-950 p-6 overflow-y-auto">
            <header className="mt-8 mb-12 text-center">
              <h1 className="text-5xl font-black text-white mb-2 tracking-tighter italic">
                COMIC<span className="text-neon-blue shadow-neon">SCAN</span>
              </h1>
              <p className="text-blue-200/70 text-sm">AI Identification & Market Valuation</p>
            </header>

            <div className="grid gap-4">
              <button
                onClick={actions.startCamera}
                className="w-full py-6 bg-gradient-to-r from-neon-blue to-blue-600 rounded-2xl shadow-neon flex flex-col items-center active:scale-95 transition-transform"
              >
                <span className="text-3xl mb-2">📸</span>
                <span className="text-white font-bold text-xl tracking-wide">SCAN COMIC</span>
              </button>

              <button
                onClick={actions.startManualSearch}
                className="w-full py-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center active:bg-white/10 transition-colors"
              >
                <span className="text-2xl mb-2 text-gray-300">🔍</span>
                <span className="text-gray-200 font-bold text-lg">MANUAL LOOKUP</span>
              </button>
            </div>

            {/* Recent History */}
            {history.length > 0 && (
              <div className="mt-10">
                <div className="flex justify-between items-end mb-4 px-1">
                  <h3 className="text-gray-500 uppercase font-bold text-xs">Recent Scans</h3>
                  <button onClick={clearHistory} className="text-xs text-gray-500 hover:text-white underline">
                    Clear
                  </button>
                </div>
                <div className="space-y-3">
                  {history.map((item, idx) => {
                    // Long press logic
                    let pressTimer = null;
                    const startPress = () => {
                      pressTimer = setTimeout(() => {
                        deleteHistoryItem(item);
                      }, 800);
                    };
                    const cancelPress = () => {
                      if (pressTimer) clearTimeout(pressTimer);
                    };

                    return (
                      <div
                        key={idx}
                        className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/5 active:bg-red-500/10 transition-colors select-none"
                        onClick={() => actions.openHistoryItem(item)}
                        onMouseDown={startPress}
                        onMouseUp={cancelPress}
                        onMouseLeave={cancelPress}
                        onTouchStart={startPress}
                        onTouchEnd={cancelPress}
                      >
                        <div className="w-10 h-14 flex-shrink-0">
                          <CoverImage
                            src={item.scanImage || item.marketImageUrl || item.coverUrl}
                            fallbackSrc="/pwa-512x512.png"
                            size="sm"
                            className="w-full h-full object-cover rounded bg-gray-900"
                            alt="cover"
                          />
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm line-clamp-1">{item.displayName}</p>
                          <p className="text-neon-blue text-xs font-mono">${item.value?.typical || 0}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <Layout>
      {renderContent()}

      {/* Global Error Toast */}
      {error && error !== 'SCAN_LIMIT_REACHED' && (
        <div className="fixed top-6 left-6 right-6 bg-red-500 text-white p-4 rounded-xl shadow-xl z-[100] flex justify-between items-center animate-slide-down">
          <span className="font-bold text-sm">{error}</span>
          <button onClick={actions.clearError} className="bg-white/20 px-3 py-1 rounded text-xs font-bold">CLOSE</button>
        </div>
      )}
    </Layout>
  );
}

export default App;