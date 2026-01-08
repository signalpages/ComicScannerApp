
import React, { useState } from 'react';

const ManualView = ({ onSearch, onCancel }) => {
    const [title, setTitle] = useState('');
    const [issue, setIssue] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (title && issue) {
            onSearch(title, issue);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 bg-midnight-950">
            <button onClick={onCancel} className="self-end text-gray-400 mb-4">✕ Close</button>

            <h2 className="text-2xl font-bold text-white mb-6">Manual Lookup</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white focus:border-neon-blue outline-none"
                        placeholder="e.g. Amazing Spider-Man"
                    />
                </div>

                <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">Issue #</label>
                    <input
                        type="text"
                        value={issue}
                        onChange={(e) => setIssue(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white focus:border-neon-blue outline-none"
                        placeholder="e.g. 300"
                    />
                </div>

                <button
                    type="submit"
                    className="mt-4 bg-neon-blue text-white font-bold py-4 rounded-xl shadow-neon"
                >
                    SEARCH
                </button>
            </form>
        </div>
    );
};

export default ManualView;
