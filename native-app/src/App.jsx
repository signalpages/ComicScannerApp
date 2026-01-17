import React, { useMemo, useEffect, useState, useCallback } from "react";
import Toast from "./components/Toast";
import Layout from "./components/Layout";
import CameraView from "./components/CameraView";
import ResultCard from "./components/ResultCard";
import CoverImage from "./components/CoverImage";
import ManualView from "./components/views/ManualView";
import VerifyView from "./components/views/VerifyView";
import SettingsView from "./components/views/SettingsView";
import { useScanFlow, SCAN_STATE } from "./hooks/useScanFlow";
import { formatCurrency } from "./utils/currency";

import { IAP } from "./services/iapBridge";
import { getDeviceId, initializeDeviceId } from "./lib/deviceId";
import { App as CapacitorApp } from '@capacitor/app';
import PaywallView from "./components/views/PaywallView";

import { API_BASE_URL } from "./config"; // CS-206

function App() {
  const {
    state,
    error,
    capturedImage,
    candidates,
    selectedCandidate,
    pricingResult,
    quotaStatus,
    history, // SS-007
    actions
  } = useScanFlow();

  // CS-205: Hidden Debug Footer
  const [debugClicks, setDebugClicks] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  const handleLogoClick = () => {
    setDebugClicks(p => {
      const next = p + 1;
      if (next >= 5) setShowDebug(true);
      return next;
    });
    setTimeout(() => setDebugClicks(0), 2000); // Reset if too slow
  };

  // Toast State
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // CS-029 & CS-030 Initializer
  const [deviceId, setDeviceId] = useState(getDeviceId());

  useEffect(() => {
    // 1. Initialize Persistent ID
    initializeDeviceId().then(id => setDeviceId(id));

    // 2. Check Entitlements (CS-030)
    // For now, we just ensure IAP bridge is ready. 
    // In a real app, we'd enable a "Premium" mode state here.
    // The apiFetch logic will pull from IAP.isEntitled() dynamically.

    // 3. CS-063: Deep Linking / Rehydration
    const params = new URLSearchParams(window.location.search);
    const scanId = params.get("scanId");
    if (scanId) {
      console.log("[App] Found scanId in URL:", scanId);
      actions.loadScanById(scanId);
    }
  }, []);

  const copyDeviceId = () => {
    navigator.clipboard.writeText(deviceId);
    showToast("Device ID Copied to Clipboard", "success");
  };

  // History is managed by useScanFlow (SS-007)
  // deleteHistoryItem removed (implemented in hook actions if needed, or disabled for now)



  // -------------------------
  // Android Back Button Handling
  // -------------------------
  // -------------------------
  // Hardware Back Button Handling
  // -------------------------
  useEffect(() => {
    // Handle Android Hardware Back Button
    const setupBackListener = async () => {
      try {
        const listener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (state !== SCAN_STATE.HOME) {
            // If inside any flow, go back to home/reset
            actions.resetFlow();
          } else {
            // If at Home, exit the app
            CapacitorApp.exitApp();
          }
        });

        // Cleanup
        return () => {
          listener.remove();
        };
      } catch (e) {
        console.warn("Back button listener setup failed (non-native?)", e);
      }
    };

    // Also keep history state handling for browser testing
    if (state === SCAN_STATE.HOME) {
      const url = new URL(window.location);
      url.search = "";
      window.history.replaceState({ view: "home" }, "", url);
    } else {
      // CS-063: Deep Link Persistence
      const url = new URL(window.location);
      if (state === SCAN_STATE.RESULT && selectedCandidate?.id) {
        url.searchParams.set("scanId", selectedCandidate.id);
      } else {
        url.searchParams.delete("scanId");
      }
      window.history.pushState({ view: state }, "", url);
    }

    const handlePopState = (event) => {
      if (state !== SCAN_STATE.HOME) {
        event.preventDefault();
        actions.resetFlow();
      }
    };
    window.addEventListener("popstate", handlePopState);

    const cleanupCap = setupBackListener();

    return () => {
      window.removeEventListener("popstate", handlePopState);
      cleanupCap.then(cleanup => cleanup && cleanup());
    };
  }, [state, actions, selectedCandidate]);


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
          <PaywallView
            scansUsed={quotaStatus?.scansUsed || 5}
            scansFree={quotaStatus?.scansFree || 5}
            resetAt={quotaStatus?.resetAt} // Passed from API
            onStartMonthly={() => IAP.purchaseMonthly()}
            onStartYearly={() => IAP.purchaseYearly()}
            onRestore={() => IAP.restorePurchases()}
            onContinueManual={actions.startManualSearch}
          />
        );

      case SCAN_STATE.MANUAL_SEARCH:
        return <ManualView onSearch={actions.performManualSearch} onCancel={actions.resetFlow} />;

      case SCAN_STATE.SETTINGS:
        return <SettingsView onBack={actions.resetFlow} onCopyId={copyDeviceId} />;

      case SCAN_STATE.HOME:
      default:
        return (
          <div className="h-full flex flex-col bg-midnight-950 p-6 overflow-y-auto">
            <header className="mt-8 mb-12 relative text-center">
              <button
                onClick={actions.openSettings}
                className="absolute right-0 top-0 p-2 text-2xl opacity-50 hover:opacity-100 active:scale-90 transition-all"
                title="Settings"
              >
                ⚙️
              </button>
              <h1
                onClick={handleLogoClick}
                className="text-5xl font-black text-white mb-2 tracking-tighter italic select-none active:scale-95 transition-transform"
              >
                COMIC<span className="text-neon-blue shadow-neon">SCAN</span>
              </h1>
              <p className="text-blue-200/70 text-sm">Scan any comic to instantly see what it's worth!</p>
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
                  <button onClick={actions.clearHistory} className="text-xs text-gray-500 hover:text-white underline">
                    Clear
                  </button>
                </div>
                <div className="space-y-3">
                  {history.map((item) => {
                    // Long press logic
                    let pressTimer = null;
                    const startPress = () => {
                      pressTimer = setTimeout(() => {
                        actions.deleteHistoryItem(item.id);
                      }, 800);
                    };
                    const cancelPress = () => {
                      if (pressTimer) clearTimeout(pressTimer);
                    };

                    return (
                      <div
                        key={item.id} // Stable Key
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
                            fallbackSrc="/placeholder-cover.png"
                            size="sm"
                            className="w-full h-full object-cover rounded bg-gray-900"
                            alt="cover"
                          />
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm line-clamp-1">{item.displayName}</p>
                          <p className="text-neon-blue text-xs font-mono">
                            {typeof item.value?.typical === 'number'
                              ? formatCurrency(item.value.typical)
                              : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Device ID REMOVED from Home as per Trust Pass */}
          </div>
        );
    }
  };

  return (
    <Layout>
      {renderContent()}

      {/* Global Toast Overlay */}
      <Toast message={toast?.message} type={toast?.type} />

      {/* Global Error Toast */}
      {error && error !== 'SCAN_LIMIT_REACHED' && (
        <div className="fixed top-6 left-6 right-6 bg-red-500 text-white p-4 rounded-xl shadow-xl z-[100] flex justify-between items-center animate-slide-down">
          <span className="font-bold text-sm">{error}</span>
          <button onClick={actions.clearError} className="bg-white/20 px-3 py-1 rounded text-xs font-bold">CLOSE</button>
        </div>
      )}
      {/* CS-205: Hidden Debug Footer */}
      {showDebug && (
        <div className="fixed bottom-0 left-0 w-full bg-black/90 text-green-400 text-[10px] font-mono p-2 z-[200] border-t border-green-900 pointer-events-none opacity-80">
          <div className="grid grid-cols-2 gap-x-4">
            <span>VER: {process.env.APP_VERSION || "1.0.17"}</span>
            <span>API: {API_BASE_URL || "Local"}</span>
            <span className="col-span-2 truncate">ID: {deviceId}</span>
            <span className="col-span-2 text-gray-500">BE: {state === SCAN_STATE.RESULT || state === SCAN_STATE.LIMIT ? (quotaStatus?.backendVersion || pricingResult?.backendVersion || "Unknown") : "Idle"}</span>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;