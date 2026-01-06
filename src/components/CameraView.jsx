import React, { useRef, useState, useEffect } from 'react';

const CameraView = ({ onCapture }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Camera Error:", err);
            setError("Unable to access camera. Please allow permissions.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsScanning(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob/file
        canvas.toBlob(async (blob) => {
            if (blob) {
                await onCapture(blob); // Parent handles the API call
                setIsScanning(false);
            }
        }, 'image/jpeg', 0.8);
    };

    return (
        <div className="relative h-full w-full bg-black flex flex-col items-center justify-center overflow-hidden">
            {error ? (
                <div className="text-red-500 p-4 text-center">
                    <p>{error}</p>
                    <button onClick={startCamera} className="mt-4 px-4 py-2 bg-gray-800 rounded text-white">Retry</button>

                    <div className="mt-8">
                        <button
                            onClick={async () => {
                                const canvas = document.createElement('canvas');
                                canvas.width = 100; canvas.height = 100;
                                const ctx = canvas.getContext('2d');
                                ctx.fillStyle = 'hotpink';
                                ctx.fillRect(0, 0, 100, 100);
                                canvas.toBlob(blob => onCapture(blob));
                            }}
                            className="px-4 py-2 bg-gray-800/80 text-white text-xs rounded-full backdrop-blur-md border border-white/10"
                        >
                            [Debug: Simulate Scan]
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Overlay Scanner UI */}
                    <div className="absolute inset-0 pointer-events-none border-[30px] border-midnight-900/50">
                        <div className="w-full h-full border-2 border-neon-blue/50 relative">
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-neon-blue"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-neon-blue"></div>
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-neon-blue"></div>
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-neon-blue"></div>

                            {isScanning && (
                                <div className="absolute inset-0 bg-neon-blue/10 animate-pulse flex items-center justify-center">
                                    <span className="text-neon-blue font-bold text-lg tracking-widest bg-black/50 px-3 py-1 rounded">ANALYZING...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Capture Button */}
                    <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center justify-center z-20 gap-4">
                        <button
                            onClick={handleCapture}
                            disabled={isScanning}
                            className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center shadow-lg transition-transform active:scale-95 ${isScanning ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                        >
                            <div className="w-16 h-16 bg-white rounded-full"></div>
                        </button>

                        <button
                            onClick={async () => {
                                const canvas = document.createElement('canvas');
                                canvas.width = 100; canvas.height = 100;
                                const ctx = canvas.getContext('2d');
                                ctx.fillStyle = 'hotpink';
                                ctx.fillRect(0, 0, 100, 100);
                                canvas.toBlob(blob => onCapture(blob));
                            }}
                            className="px-4 py-2 bg-gray-800/80 text-white text-xs rounded-full backdrop-blur-md border border-white/10"
                        >
                            [Debug: Simulate Scan]
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default CameraView;
