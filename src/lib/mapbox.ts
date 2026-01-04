/**
 * Mapbox API utilities
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export interface Coordinates {
    lat: number;
    lng: number;
}

export interface RouteResult {
    geometry: GeoJSON.LineString;
    duration: number; // seconds
    distance: number; // meters
}

/**
 * Fetch driving route between two points using Mapbox Directions API.
 * Returns GeoJSON LineString geometry for drawing on map.
 */
export async function getRoute(
    start: Coordinates,
    end: Coordinates
): Promise<RouteResult | null> {
    if (!MAPBOX_TOKEN) {
        console.error("Mapbox token is missing");
        return null;
    }

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.lng},${start.lat};${end.lng},${end.lat}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                geometry: route.geometry,
                duration: route.duration,
                distance: route.distance,
            };
        }
        return null;
    } catch (error) {
        console.error("Error fetching route:", error);
        return null;
    }
}

/**
 * Calculate bearing (heading) between two points in degrees.
 * Used to rotate the car icon.
 */
export function calculateBearing(
    start: Coordinates,
    end: Coordinates
): number {
    const startLat = (start.lat * Math.PI) / 180;
    const startLng = (start.lng * Math.PI) / 180;
    const endLat = (end.lat * Math.PI) / 180;
    const endLng = (end.lng * Math.PI) / 180;

    const dLng = endLng - startLng;

    const x = Math.sin(dLng) * Math.cos(endLat);
    const y =
        Math.cos(startLat) * Math.sin(endLat) -
        Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

    const bearing = Math.atan2(x, y);
    return ((bearing * 180) / Math.PI + 360) % 360;
}

/**
 * Linear interpolation between two coordinates.
 * Used for smooth car animation.
 */
export function interpolatePosition(
    start: Coordinates,
    end: Coordinates,
    t: number // 0 to 1
): Coordinates {
    return {
        lat: start.lat + (end.lat - start.lat) * t,
        lng: start.lng + (end.lng - start.lng) * t,
    };
}

export interface ReverseGeocodeResult {
    fullAddress: string;
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
}

/**
 * Reverse geocode: Convert GPS coordinates into a human-readable address.
 * Uses Mapbox Geocoding API.
 */
export async function reverseGeocode(
    coords: Coordinates
): Promise<ReverseGeocodeResult | null> {
    if (!MAPBOX_TOKEN) {
        console.error("Mapbox token is missing for reverse geocoding");
        return null;
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?access_token=${MAPBOX_TOKEN}&language=es&types=address,poi,neighborhood,locality`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const feature = data.features[0];

            // Extract context info (neighborhood, city, state)
            const context = feature.context || [];
            const neighborhood = context.find((c: any) => c.id.startsWith("neighborhood"))?.text;
            const locality = context.find((c: any) => c.id.startsWith("locality"))?.text;
            const place = context.find((c: any) => c.id.startsWith("place"))?.text;
            const region = context.find((c: any) => c.id.startsWith("region"))?.text;

            return {
                fullAddress: feature.place_name,
                street: feature.text,
                neighborhood: neighborhood || locality,
                city: place,
                state: region,
            };
        }
        return null;
    } catch (error) {
        console.error("Error in reverse geocoding:", error);
        return null;
    }
}

export interface ForwardGeocodeResult {
    coords: Coordinates;
    placeName: string;
    address: string;
}

/**
 * Forward geocode: Convert an address/query string into GPS coordinates.
 * Uses Mapbox Geocoding API for address search.
 */
export async function forwardGeocode(
    query: string
): Promise<ForwardGeocodeResult[]> {
    if (!MAPBOX_TOKEN) {
        console.error("Mapbox token is missing for forward geocoding");
        return [];
    }

    if (!query || query.trim().length < 3) {
        return [];
    }

    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_TOKEN}&language=es&country=MX&limit=5`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            return data.features.map((feature: any) => ({
                coords: {
                    lat: feature.center[1],
                    lng: feature.center[0],
                },
                placeName: feature.text,
                address: feature.place_name,
            }));
        }
        return [];
    } catch (error) {
        console.error("Error in forward geocoding:", error);
        return [];
    }
}

