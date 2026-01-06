import React, { useState } from 'react';
import Layout from './components/Layout';
import CameraView from './components/CameraView';
import ResultCard from './components/ResultCard';
import { identifyComic } from './services/aiScanner';
import { getComicDetails } from './services/comicData';

const ManualView = ({ onSearch }) => {
  const [title, setTitle] = useState('');
  const [issue, setIssue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({ title, issue_number: issue });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center relative z-10">
      <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple mb-8 drop-shadow-sm">Manual Search</h2>
      <form onSubmit={handleSubmit} className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-white/10">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Comic Title (e.g. Amazing Spider-Man)"
          className="w-full glass-input rounded-xl p-4 mb-3 text-white placeholder-gray-400"
        />
        <input
          type="text"
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          placeholder="Issue #"
          className="w-full glass-input rounded-xl p-4 mb-8 text-white placeholder-gray-400"
        />
        <button type="submit" className="w-full bg-gradient-to-r from-neon-purple to-neon-pink text-white font-bold py-4 rounded-xl shadow-lg shadow-neon-purple/20 active:scale-95 transition-all hover:shadow-neon-purple/40">
          Search Database
        </button>
      </form>
    </div>
  );
};

function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'scan' | 'manual' | 'result'
  const [scanResult, setScanResult] = useState(null);
  const [lastScannedResult, setLastScannedResult] = useState(null); // Persist last result for dashboard
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorData, setErrorData] = useState(null);

  const handleScan = async (blob) => {
    setIsProcessing(true);
    setErrorData(null);
    try {
      // 1. Identify
      const aiData = await identifyComic(blob);

      if (aiData.error) {
        console.error(aiData.error);
        setErrorData("Could not identify comic. Please try again.");
        setIsProcessing(false);
        return;
      }

      // 2. Get Pricing
      const pricingData = await getComicDetails(aiData.title, aiData.issue_number);

      const result = {
        aiData,
        pricingData,
        imageBlob: blob
      };

      setScanResult(result);
      setLastScannedResult(result); // Cache for dashboard
      setCurrentView('result');
    } catch (error) {
      console.error(error);
      setErrorData("Scan failed due to an error.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSearch = async (manualData) => {
    setIsProcessing(true);
    setErrorData(null);
    try {
      const pricingData = await getComicDetails(manualData.title, manualData.issue_number);
      // Construct AI Data for manual
      const aiData = {
        title: manualData.title,
        issue_number: manualData.issue_number,
        publisher: 'Unknown',
        year: pricingData.cover_date ? pricingData.cover_date.split('-')[0] : '????',
        condition_estimate: 'Manual'
      };

      let imageBlob = null;
      if (pricingData.cover_image) {
        try {
          const resp = await fetch(pricingData.cover_image);
          imageBlob = await resp.blob();
        } catch (e) {
          console.error("Failed to fetch mock cover", e);
        }
      }

      const result = { aiData, pricingData, imageBlob };
      setScanResult(result);
      setLastScannedResult(result);
      setCurrentView('result');
    } catch (e) {
      setErrorData("Search failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Dashboard Tiles Component
  const Dashboard = () => (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-display font-bold text-white mb-2">Welcome Back, <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">Collector</span></h1>
        <p className="text-gray-400 text-sm">Ready to hunt for some key issues?</p>
      </header>

      <div className="grid grid-cols-2 gap-4 auto-rows-[160px] flex-1">
        {/* Live Scanner Tile */}
        <div
          onClick={() => setCurrentView('scan')}
          className="col-span-2 glass-panel rounded-3xl p-6 relative overflow-hidden cursor-pointer group hover:border-neon-blue/50 transition-all duration-300 hover:scale-[1.02] active:scale-95"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-neon-blue/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="w-12 h-12 rounded-full bg-neon-blue/20 flex items-center justify-center text-neon-blue mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">Live Scanner</h3>
              <p className="text-xs text-gray-300">Identify comics instantly via camera</p>
            </div>
          </div>
        </div>

        {/* Manual Entry Tile */}
        <div
          onClick={() => setCurrentView('manual')}
          className="glass-panel rounded-3xl p-5 relative overflow-hidden cursor-pointer group hover:border-neon-purple/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex flex-col justify-between"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-full bg-neon-purple/20 flex items-center justify-center text-neon-purple">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">Manual<br />Lookup</h3>
          </div>
        </div>

        {/* Last Scanned Tile (Conditional) */}
        <div
          onClick={() => lastScannedResult && setCurrentView('result')}
          className={`glass-panel rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between transition-all duration-300 ${lastScannedResult ? 'cursor-pointer group hover:border-pink-500/50 hover:scale-[1.02] active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
        >
          {lastScannedResult ? (
            <>
              <div className="absolute inset-0">
                {lastScannedResult.imageBlob && (
                  <img
                    src={URL.createObjectURL(lastScannedResult.imageBlob)}
                    className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity"
                    alt="Last scanned"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
              </div>
              <div className="relative z-10 w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-neon-pink mb-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="relative z-10">
                <div className="inline-block px-2 py-0.5 rounded bg-pink-500/20 text-[9px] font-bold text-neon-pink mb-1 uppercase tracking-wider">Recent</div>
                <h3 className="text-sm font-bold text-white truncate">{lastScannedResult.aiData.title}</h3>
                <p className="text-[10px] text-gray-400">#{lastScannedResult.aiData.issue_number}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-gray-700/50 flex items-center justify-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-500 leading-tight">No Recent<br />Scans</h3>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {isProcessing && (
        <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
          <div className="w-16 h-16 border-4 border-t-neon-blue border-r-transparent border-b-neon-purple border-l-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white font-bold animate-pulse">Consulting the Oracle...</p>
        </div>
      )}

      {errorData && (
        <div className="absolute top-20 left-4 right-4 bg-red-500/90 text-white p-4 rounded-lg z-50 shadow-lg flex justify-between items-center">
          <span>{errorData}</span>
          <button onClick={() => setErrorData(null)} className="font-bold">x</button>
        </div>
      )}

      {currentView === 'home' && <Dashboard />}

      {currentView === 'scan' && <CameraView onCapture={handleScan} />}

      {currentView === 'manual' && <ManualView onSearch={handleManualSearch} />}

      {currentView === 'result' && (
        <ResultCard
          data={scanResult}
          onRescan={() => setCurrentView('scan')}
        />
      )}
    </Layout>
  );
}

export default App;
