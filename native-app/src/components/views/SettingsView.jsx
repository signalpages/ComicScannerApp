import React from "react";
import { getDeviceId } from "../../lib/deviceId";

const SettingsView = ({ onBack, onCopyId }) => {
    return (
        <div className="min-h-full bg-midnight-950 text-white flex flex-col p-6 animate-fade-in pb-20">
            <header className="flex items-center mb-8 gap-4">
                <button
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
                >
                    <span className="text-xl">←</span>
                </button>
                <h1 className="text-2xl font-bold">Settings</h1>
            </header>

            <div className="flex-1 space-y-8">
                {/* App Info */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <div className="flex items-center gap-4 mb-4">
                        <img src="/pwa-192x192.png" alt="Logo" className="w-16 h-16 rounded-xl shadow-lg" />
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">ComicScan</h2>
                            <p className="text-sm text-gray-400">Version 1.0.0</p>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        © 2026 AppKrewe LLC. All rights reserved.
                    </p>
                </div>

                {/* Support */}
                <section>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Support</h3>
                    <a
                        href={`mailto:support@appkrewe.com?subject=ComicScan Support (Device: ${getDeviceId()})`}
                        className="block w-full p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 active:scale-[0.98] transition-all"
                    >
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">Contact Support</span>
                            <span>📧</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">support@appkrewe.com</p>
                    </a>
                </section>

                {/* Legal */}
                <section className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 px-1">Legal</h3>

                    <details className="group bg-white/5 border border-white/5 rounded-xl overflow-hidden">
                        <summary className="flex justify-between items-center p-4 cursor-pointer font-semibold select-none bg-white/5 hover:bg-white/10">
                            Privacy Policy
                            <span className="group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="p-4 text-sm text-gray-400 leading-relaxed border-t border-white/5 bg-black/20">
                            <p className="mb-2"><strong>Effective Date: Jan 1, 2026</strong></p>
                            <p className="mb-2">
                                ComicScan ("we") respects your privacy. We process images you upload specifically for comic identification.
                                We collect anonymous usage data to improve our services.
                            </p>
                            <p className="mb-2">
                                We do not sell your personal data. Images may be processed by third-party AI providers (e.g. OpenAI) solely for identification purposes and are not used to train their models without permission.
                            </p>
                            <p>For deletion requests, contact support@appkrewe.com.</p>
                        </div>
                    </details>

                    <details className="group bg-white/5 border border-white/5 rounded-xl overflow-hidden">
                        <summary className="flex justify-between items-center p-4 cursor-pointer font-semibold select-none bg-white/5 hover:bg-white/10">
                            Terms of Service
                            <span className="group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="p-4 text-sm text-gray-400 leading-relaxed border-t border-white/5 bg-black/20">
                            <p className="mb-2">
                                By using ComicScan, you agree to these terms. Our services are provided "as is".
                                Market values provided are estimates based on third-party data and are not guaranteed to be accurate.
                            </p>
                            <p className="mb-2">
                                You agree not to use the app for illegal purposes or to reverse engineer our API.
                                We reserve the right to terminate access for abuse of our fair use policy.
                            </p>
                            <p>For questions, contact support@appkrewe.com.</p>
                        </div>
                    </details>
                </section>
            </div>

            <div className="mt-8 text-center pb-8">
                <p className="text-[10px] text-gray-600 uppercase font-bold mb-1">Device ID</p>
                <div
                    onClick={onCopyId}
                    className="inline-block px-4 py-2 bg-white/5 rounded-full border border-white/5 cursor-pointer active:scale-95 transition-transform"
                >
                    <code className="text-[10px] text-gray-500 font-mono tracking-wider">{getDeviceId()}</code>
                </div>
                <p className="text-[10px] text-gray-600 mt-2 max-w-xs mx-auto">
                    CS-031: ID resets if app data is cleared.
                </p>
                {process.env.BUILD_TIMESTAMP && (
                    <div className="text-[10px] text-gray-700 mt-4 opacity-70">
                        Build: {process.env.BUILD_TIMESTAMP}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsView;
