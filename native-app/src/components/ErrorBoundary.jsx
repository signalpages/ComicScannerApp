import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    handleRestart = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-[100dvh] w-full bg-black flex flex-col items-center justify-center p-6 text-center">
                    <div className="text-6xl mb-4">😵</div>
                    <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
                    <p className="text-gray-400 mb-8 max-w-xs text-sm">
                        We encountered an unexpected error.
                    </p>
                    <button
                        onClick={this.handleRestart}
                        className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-bold active:scale-95 transition-transform"
                    >
                        RESTART APP
                    </button>
                    {process.env.NODE_ENV !== 'production' && (
                        <pre className="mt-8 text-left text-xs text-red-400 bg-black/50 p-4 rounded w-full overflow-auto max-h-40">
                            {this.state.error?.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
