"use client";

import { Map, MapProps } from "@vis.gl/react-google-maps";

interface MapCanvasProps extends MapProps {
    className?: string;
}

const DEFAULT_CENTER = { lat: 19.432608, lng: -99.133209 }; // CDMX Zocalo
const DEFAULT_ZOOM = 15;

/**
 * Reusable Map Canvas component.
 * Uses @vis.gl/react-google-maps Map component.
 */
export function MapCanvas({
    className = "w-full h-full",
    defaultCenter = DEFAULT_CENTER,
    defaultZoom = DEFAULT_ZOOM,
    disableDefaultUI = true,
    ...props
}: MapCanvasProps) {
    return (
        <div className={className}>
            <Map
                defaultCenter={defaultCenter}
                defaultZoom={defaultZoom}
                disableDefaultUI={disableDefaultUI}
                gestureHandling={'greedy'} // Improve mobile touch handling
                {...props}
            />
        </div>
    );
}
