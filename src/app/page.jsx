"use client";

import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';

// Dynamic import of the existing App component to ensure client-side only if needed, 
// though App.jsx is React logic it should be fine. 
// However, since we are moving from likely a Client-side only bootstrap, keep it "use client".

import App from '../App';

export default function Page() {
    return <App />;
}
