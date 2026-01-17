import React from 'react';

// CS-203: Paywall View with Glassmorphism & Neon Design
const PaywallView = ({ scansUsed, scansFree, resetAt, onStartMonthly, onStartYearly, onRestore, onContinueManual }) => {
    const percentage = Math.min(100, (scansUsed / scansFree) * 100);

    return (
        <div className="min-h-full flex flex-col items-center justify-center p-6 animate-fade-in relative overflow-hidden bg-midnight-950 text-white">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-electric-violet-500/20 rounded-full blur-[128px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-neon-blue-500/10 rounded-full blur-[128px]" />
            </div>

            <div className="z-10 w-full max-w-md space-y-8">

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="inline-block p-4 rounded-full bg-white/5 mb-4 backdrop-blur-md border border-white/10 shadow-xl shadow-electric-violet-500/10">
                        <span className="text-4xl filter drop-shadow-glow">💎</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        Unlock Unlimited<br />Comic Scans
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Remove all limits and scan your entire collection without interruption.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="space-y-4">
                    {/* Yearly Best Value */}
                    <button
                        onClick={onStartYearly}
                        className="w-full relative group overflow-hidden rounded-2xl p-[1px] transition-all active:scale-[0.98]"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-electric-violet-500 to-neon-blue-500 opacity-100" />
                        <div className="relative h-full bg-midnight-900/90 backdrop-blur-xl rounded-2xl p-5 flex justify-between items-center group-hover:bg-midnight-900/80 transition-colors">
                            <div className="text-left">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg">Yearly Access</span>
                                    <span className="text-[10px] font-bold bg-electric-violet-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg shadow-electric-violet-500/40">
                                        Save 33%
                                    </span>
                                </div>
                                <p className="text-sm text-gray-400 mt-1">$39.99 / year</p>
                            </div>
                            <div className="w-6 h-6 rounded-full border-2 border-electric-violet-500 flex items-center justify-center">
                                <div className="w-3 h-3 bg-electric-violet-500 rounded-full" />
                            </div>
                        </div>
                    </button>

                    {/* Monthly */}
                    <button
                        onClick={onStartMonthly}
                        className="w-full relative group overflow-hidden rounded-2xl p-[1px] transition-all active:scale-[0.98]"
                    >
                        <div className="absolute inset-0 bg-white/10" />
                        <div className="relative h-full bg-midnight-900/40 backdrop-blur-md rounded-2xl p-5 flex justify-between items-center border border-white/5 hover:bg-white/5 transition-colors">
                            <div className="text-left">
                                <span className="font-bold text-lg">Monthly Access</span>
                                <p className="text-sm text-gray-400 mt-1">$4.99 / month</p>
                            </div>
                            <div className="w-6 h-6 rounded-full border-2 border-white/20" />
                        </div>
                    </button>
                </div>

                {/* Restore */}
                <button
                    onClick={onRestore}
                    className="text-sm text-gray-500 font-medium hover:text-white transition-colors"
                >
                    Restore Purchase
                </button>

                {/* Footer / Manual Lookup */}
                <div className="pt-6 border-t border-white/5">
                    <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between mb-4">
                        <div className="text-sm font-medium text-gray-300">Free Scans Used</div>
                        <div className="text-sm font-bold text-white">{scansUsed} / {scansFree}</div>
                    </div>

                    <button
                        onClick={onContinueManual}
                        className="w-full py-4 rounded-xl font-bold bg-white/5 text-gray-300 hover:bg-white/10 active:scale-[0.98] transition-all border border-white/5"
                    >
                        Continue with Manual Lookup
                    </button>
                    <p className="text-center text-xs text-gray-600 mt-4 px-8">
                        Manual text search is always free. Subscription auto-renews. Cancel anytime in store settings.
                    </p>
                </div>

            </div>
        </div>
    );
};

export default PaywallView;
