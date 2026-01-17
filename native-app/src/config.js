// CS-206: API Base URL Single Source
import { Capacitor } from '@capacitor/core';

const PROD_API = "https://comicscanner-api.vercel.app";
const LOCAL_API = "http://localhost:3000"; // Or your local IP

// Native always hits prod (unless switched for dev debug). Web uses relative or prod.
export const API_BASE_URL = Capacitor.isNativePlatform()
    ? PROD_API
    : (import.meta.env.VITE_API_BASE_URL || PROD_API); // Allow Vite env override
