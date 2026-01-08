import React, { useMemo } from "react";
import Layout from "./components/Layout";
import CameraView from "./components/CameraView";
import ResultCard from "./components/ResultCard";
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
    actions
  } = useScanFlow();

  // History (read from local storage for Home view)
  const history = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('scanHistory') || '[]');
    } catch { return []; }
  }, [state]); // Re-read on state change (e.g. after scan result)

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
            image={capturedImage || '/default_cover.png'} // Fallback for manual verify path?
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
                cover_image: selectedCandidate?.coverUrl,
                publisher: selectedCandidate?.publisher,
                cover_date: selectedCandidate?.year
              },
              scanImage: capturedImage // Pass base64 capture directly
            }}
            onRescan={actions.startCamera}
          />
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
                <h3 className="text-gray-500 uppercase font-bold text-xs mb-4 ml-1">Recent Scans</h3>
                <div className="space-y-3">
                  {history.map((item, idx) => (
                    <div key={idx} className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                      <img src={item.coverUrl} className="w-10 h-14 object-cover rounded bg-gray-900" alt="cover" />
                      <div>
                        <p className="text-white font-bold text-sm line-clamp-1">{item.displayName}</p>
                        <p className="text-neon-blue text-xs font-mono">${item.value?.typical || 0}</p>
                      </div>
                    </div>
                  ))}
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