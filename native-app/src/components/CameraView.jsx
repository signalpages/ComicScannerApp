import React, { useRef, useEffect, useState, useCallback } from "react";

const CameraView = ({ onCapture, onManualFallback }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);
    const [isReady, setIsReady] = useState(false);

    // Initialize Camera
    useEffect(() => {
        let activeStream = null;

        const startCamera = async () => {
            try {
                const constraints = {
                    video: {
                        facingMode: "environment", // Rear camera
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                };

                const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                activeStream = mediaStream;
                setStream(mediaStream);

                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    // Robust Playback
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play().catch(e => console.warn("Play interrupted", e));
                        setIsReady(true);
                    };
                }
            } catch (err) {
                console.error("Camera Init Failed", err);
                setError("Camera access denied or unavailable.");
            }
        };

        startCamera();

        return () => {
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop());
            }
            setIsReady(false);
        };
    }, []);

    const handleCapture = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !isReady) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Match canvas size to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
            // Draw current frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Get Base64 (JPEG)
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85); // 0.85 quality
            const cleanBase64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

            onCapture(cleanBase64);
        }
    }, [isReady, onCapture]);

    return (
        <div className="relative h-[100dvh] w-full bg-black overflow-hidden select-none">
            {/* Hidden Canvas for Capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video Preview */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Loading State */}
            {!isReady && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-white/20 border-t-neon-blue rounded-full animate-spin"></div>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 p-6 text-center transform transition-all">
                    <p className="text-red-400 font-bold mb-4">{error}</p>
                    <button
                        onClick={onManualFallback}
                        className="px-6 py-3 bg-neon-blue/20 text-neon-blue border border-neon-blue/50 rounded-xl font-bold"
                    >
                        Use Manual Lookup
                    </button>
                </div>
            )}

            {/* Controls Overlay */}
            {isReady && !error && (
                <>
                    <div className="absolute top-6 right-6 z-50">
                        <button
                            onClick={onManualFallback}
                            className="text-white/80 font-bold text-sm bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md active:bg-white/20"
                        >
                            Manual Search
                        </button>
                    </div>

                    <div className="absolute bottom-12 left-0 right-0 flex justify-center z-50 pb-safe">
                        <button
                            onClick={handleCapture}
                            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm shadow-lg active:scale-95 transition-transform flex items-center justify-center group"
                        >
                            <div className="w-16 h-16 rounded-full bg-white group-active:scale-90 transition-transform" />
                        </button>
                    </div>

                    {/* Viewfinder Graphic (Optional) */}
                    <div className="absolute inset-0 pointer-events-none opacity-30 flex items-center justify-center">
                        <div className="w-[70%] aspect-[2/3] border border-white/50 rounded-lg"></div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CameraView;
