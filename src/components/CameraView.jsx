import React, { useRef, useState, useEffect } from "react";

const CameraView = ({ onCapture, onManualFallback }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [isScanning, setIsScanning] = useState(false);
    // error types: 'PERMISSION_DENIED', 'UNAVAILABLE', 'GENERIC'
    const [errorState, setErrorState] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function start() {
            try {
                // Pre-check permissions if supported (optional polish, but getUserMedia is authority)
                // Just try to get the stream
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: 1280, height: 720 },
                    audio: false,
                });

                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => { });
                    setErrorState(null); // Success
                }
            } catch (e) {
                console.error("Camera Error:", e);
                if (cancelled) return;

                if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
                    setErrorState("PERMISSION_DENIED");
                } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
                    setErrorState("UNAVAILABLE");
                } else {
                    setErrorState("GENERIC");
                }
            }
        }

        start();

        return () => {
            cancelled = true;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    const captureOnce = () => {
        if (isScanning || errorState) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        if (video.readyState < 2) return;

        setIsScanning(true);

        try {
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            const maxW = 720;
            const scale = Math.min(1, maxW / video.videoWidth);

            canvas.width = Math.floor(video.videoWidth * scale);
            canvas.height = Math.floor(video.videoHeight * scale);

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL("image/jpeg", 0.65);

            if (typeof dataUrl === "string" && dataUrl.startsWith("data:image")) {
                onCapture(dataUrl);
            } else {
                setErrorState("GENERIC");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setTimeout(() => setIsScanning(false), 200);
        }
    };

    // --- RENDER ERROR MODAL ---
    if (errorState) {
        return (
            <div className="relative h-[100dvh] w-full bg-midnight-950 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6">
                    <span className="text-3xl">📷</span>
                </div>

                <h2 className="text-2xl font-black text-white mb-3">Camera Access Needed</h2>

                <p className="text-gray-400 mb-8 max-w-xs">
                    {errorState === "PERMISSION_DENIED"
                        ? "Camera access is required. Please enable it in your device settings."
                        : "We couldn't connect to the camera on this device."
                    }
                </p>

                <button
                    onClick={onManualFallback}
                    className="w-full max-w-xs py-4 bg-gradient-to-r from-neon-blue to-blue-600 rounded-xl font-bold text-white shadow-neon mb-6 active:scale-95 transition-transform"
                >
                    USE MANUAL LOOKUP
                </button>
            </div>
        );
    }

    return (
        <div className="relative h-[100dvh] w-full bg-black overflow-hidden pointer-events-auto">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
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
