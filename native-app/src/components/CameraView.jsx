import React, { useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

const CameraView = ({ onCapture, onManualFallback }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [err, setErr] = useState(null);

    const takePhoto = async () => {
        if (isScanning) return;
        setErr(null);
        setIsScanning(true);

        try {
            const photo = await Camera.getPhoto({
                source: CameraSource.Camera,
                resultType: CameraResultType.Base64,
                quality: 90,
                correctOrientation: true,
            });

            if (!photo?.base64String) {
                throw new Error("No image returned from camera");
            }

            // Send base64 without data: prefix (backend expects raw base64)
            onCapture(photo.base64String);
        } catch (e) {
            console.error("[CameraView] capture failed", e);
            setErr("Camera failed. Please try again.");
            setIsScanning(false);
        }
    };

    return (
        <div className="relative h-[100dvh] w-full bg-black overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center text-white/30">
                {/* Optional: background placeholder */}
            </div>

            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={onManualFallback}
                    className="text-white/80 font-bold text-sm bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md active:bg-white/20"
                >
                    Manual Search
                </button>
            </div>

            {err && (
                <div className="absolute top-20 left-0 right-0 mx-auto w-[92%] max-w-md bg-red-500/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl">
                    {err}
                </div>
            )}

            <div className="absolute bottom-10 left-0 right-0 flex justify-center z-50">
                <button
                    onClick={takePhoto}
                    disabled={isScanning}
                    className={`w-20 h-20 rounded-full border-4 shadow-lg active:scale-95 transition-transform ${isScanning ? "bg-gray-700 border-gray-500" : "bg-white border-neon-blue"
                        }`}
                    aria-label="Capture"
                />
            </div>

            {isScanning && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-neon-blue font-bold z-40 animate-pulse">
                    CAPTURING...
                </div>
            )}
        </div>
    );
};

export default CameraView;
