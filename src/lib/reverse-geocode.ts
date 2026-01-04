/**
 * Reverse Geocoding using Nominatim (OpenStreetMap) - FREE
 * Converts GPS coordinates to human-readable addresses
 */

interface ReverseGeocodeResult {
    display_name: string;
    address: {
        road?: string;
        house_number?: string;
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        country?: string;
    };
}

interface SimpleAddress {
    full: string;
    short: string;
    street: string;
    area: string;
}

/**
 * Convert coordinates to a readable address using Nominatim API
 * Rate limit: 1 request per second (we cache results)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<SimpleAddress | null> {
    // Validate coordinates
    if (!lat || !lng || lat === 0 || lng === 0) {
        return null;
    }

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'MoVix-App/1.0', // Required by Nominatim
                },
            }
        );

        if (!response.ok) {
            console.error('Nominatim API error:', response.status);
            return null;
        }

        const data: ReverseGeocodeResult = await response.json();

        // Build a short, readable address
        const addr = data.address;
        const street = addr.road || addr.neighbourhood || addr.suburb || '';
        const number = addr.house_number || '';
        const area = addr.neighbourhood || addr.suburb || addr.city || addr.town || addr.village || '';

        const shortAddress = number
            ? `${street} #${number}`
            : street || area;

        return {
            full: data.display_name,
            short: shortAddress || 'Ubicación detectada',
            street: street,
            area: area,
        };
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return null;
    }
}

/**
 * Calculate distance between two GPS points in meters
 * Uses Haversine formula
 */
export function calculateDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
    if (meters < 100) return 'Muy cerca';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Calculate cardinal direction from point A to point B
 */
export function getDirection(
    fromLat: number, fromLng: number,
    toLat: number, toLng: number
): string {
    const dLat = toLat - fromLat;
    const dLng = toLng - fromLng;

    const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);

    if (angle >= -22.5 && angle < 22.5) return 'Norte';
    if (angle >= 22.5 && angle < 67.5) return 'Noreste';
    if (angle >= 67.5 && angle < 112.5) return 'Este';
    if (angle >= 112.5 && angle < 157.5) return 'Sureste';
    if (angle >= 157.5 || angle < -157.5) return 'Sur';
    if (angle >= -157.5 && angle < -112.5) return 'Suroeste';
    if (angle >= -112.5 && angle < -67.5) return 'Oeste';
    return 'Noroeste';
}
