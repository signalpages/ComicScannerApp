import React, { useState } from 'react';
import EmptyCover from './EmptyCover';

const CoverImage = ({ src, alt, className = "", size = "md", fallbackSrc = null }) => {
    const [error, setError] = useState(false);

    // If no source or prior error, show empty state
    if (!src || src === "/default_cover.png" || error) {
        return <EmptyCover size={size} className={className} src={fallbackSrc} />;
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            onError={() => setError(true)}
        />
    );
};

export default CoverImage;
