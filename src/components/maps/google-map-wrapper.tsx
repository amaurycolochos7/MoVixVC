"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { ReactNode } from "react";

interface GoogleMapWrapperProps {
    children: ReactNode;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

/**
 * Wrapper for Google Maps API Provider.
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
 * Ensure the API Key is restricted by HTTP Referrer in Google Cloud Console.
 */
export function GoogleMapWrapper({ children }: GoogleMapWrapperProps) {
    if (!API_KEY) {
        console.warn("Google Maps API Key is missing. Maps will not render correctly.");
    }

    return (
        <APIProvider apiKey={API_KEY} libraries={['places', 'geometry']}>
            {children}
        </APIProvider>
    );
}
