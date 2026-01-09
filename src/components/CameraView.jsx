import React, { useRef, useState, useEffect } from "react";

const CameraView = ({ onCapture }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function start() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: 1280, height: 720 },
                    audio: false,
                });

                if (cancelled) return;
                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => { });
                }
            } catch (e) {
                console.error(e);
                setError(
                    "Camera failed to start. Check permissions, HTTPS, and device support."
                );
            }
        }

        start();

        return () => {
            cancelled = true;
            // ✅ stop camera on unmount
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    const captureOnce = () => {
  if (isScanning) return; // hard guard

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState < 2) {
        setError("Camera not ready yet. Try again in a second.");
        return;
    }

    setIsScanning(true);
    setError("");

    try {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        // ✅ downscale to keep payload small
        const maxW = 720;
        const scale = Math.min(1, maxW / video.videoWidth);

        canvas.width = Math.floor(video.videoWidth * scale);
        canvas.height = Math.floor(video.videoHeight * scale);

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
        console.log("CAPTURE len:", dataUrl.length);

        if (typeof dataUrl === "string" && dataUrl.startsWith("data:image")) {
        onCapture(dataUrl); // ✅ ONLY ONCE
        } else {
        setError("Failed to capture image.");
        }
    } catch (e) {
        console.error(e);
        setError("Failed to capture image.");
    } finally {
        // tiny delay prevents rapid double taps from firing again instantly
        setTimeout(() => setIsScanning(false), 200);
    }
    };


    return (
        <div className="relative h-[100dvh] w-full bg-black overflow-hidden pointer-events-auto">
            <div className="absolute top-4 left-4 text-[10px] text-white/50 z-50 pointer-events-none">
                camera-v1-prod
            </div>

            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
            />

            <canvas ref={canvasRef} className="hidden" />

            {/* Pinned Bottom Controls */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-50 pointer-events-auto">
                <button
                    onClick={captureOnce}
                    disabled={isScanning || !!error}
                    className={`w-20 h-20 rounded-full border-4 shadow-lg active:scale-95 transition-transform ${isScanning ? "bg-gray-700 border-gray-500" : "bg-white border-neon-blue"
                        }`}
                    title={error ? "Fix camera error first" : "Capture"}
                />
            </div>

            {isScanning && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-blue-400 font-bold z-40">
                    CAPTURING...
                </div>
            )}

            {error && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-6 z-40">
                    <div className="text-red-300 font-bold mb-2">Camera Error</div>
                    <div className="text-white/80 text-sm max-w-sm">{error}</div>
                    <button
                        className="mt-4 px-4 py-2 bg-white/10 text-white rounded"
                        onClick={() => setError("")}
                    >
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
};

export default CameraView;
