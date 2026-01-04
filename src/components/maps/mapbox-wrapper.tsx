"use client";

import { ReactNode } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapboxWrapperProps {
    children: ReactNode;
}

/**
 * Wrapper to import Mapbox CSS globally.
 * This must be included once in the app.
 */
export function MapboxWrapper({ children }: MapboxWrapperProps) {
    return <>{children}</>;
}
