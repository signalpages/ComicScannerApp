import React, { useRef, useState, useEffect } from "react";
import { Camera } from '@capacitor/camera';

const CameraView = ({ onCapture, onManualFallback }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [isScanning, setIsScanning] = useState(false);
    // error types: 'PERMISSION_DENIED', 'UNAVAILABLE', 'GENERIC'
    const [errorState, setErrorState] = useState(null);

    const [isStreamReady, setIsStreamReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        // ... (initCamera logic remains, but we add setIsStreamReady(true) after success)

        async function initCamera() {
            // ... existing logic ...
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Play is handled by onLoadedMetadata/onCanPlay now for robustness
                // But we can still try here
                await videoRef.current.play().catch(() => { });
                setErrorState(null);
                // Note: We'll set ready state in the video event listeners to be sure
            }
            // ...
        }
        initCamera();
        // ...
    }, []);

    // ...

    return (
        <div className="relative h-[100dvh] w-full bg-black overflow-hidden pointer-events-auto">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => {
                    const video = videoRef.current;
                    if (video) {
                        video.play().catch(e => console.warn("Auto-play failed", e));
                    }
                }}
                onPlaying={() => setIsStreamReady(true)}
                className="w-full h-full object-cover transition-opacity duration-500"
                style={{ opacity: isStreamReady ? 1 : 0 }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Controls */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-50 pointer-events-auto">
                <button
                    onClick={captureOnce}
                    disabled={isScanning}
                    className={`w-20 h-20 rounded-full border-4 shadow-lg active:scale-95 transition-transform ${isScanning ? "bg-gray-700 border-gray-500" : "bg-white border-neon-blue"
                        }`}
                />
            </div>

            {/* Manual Fallback Link (Always visible in camera mode too for convenience) */}
            <button
                onClick={onManualFallback}
                className="absolute top-6 right-6 text-white/80 font-bold text-sm bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md active:bg-white/20"
            >
                Manual Search
            </button>

            {isScanning && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-neon-blue font-bold z-40 animate-pulse">
                    CAPTURING...
                </div>
            )}
        </div>
    );
};

export default CameraView;
