import React from "react";

const ConfirmModal = ({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    confirmTone = "primary",
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    const isDanger = confirmTone === "danger";

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Modal Card */}
            <div className="relative bg-midnight-950 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-slide-up-fade">
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-gray-400 mb-8 leading-relaxed">
                    {message}
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 bg-white/5 text-white font-bold rounded-xl border border-white/5 active:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-3 font-bold rounded-xl shadow-lg active:scale-95 transition-transform ${isDanger
                                ? "bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20"
                                : "bg-gradient-to-r from-neon-blue to-blue-600 text-white shadow-neon"
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
