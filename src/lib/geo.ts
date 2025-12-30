export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

export const RADAR_RADIUS_KM = 5;
export const TRACKING_UPDATE_INTERVAL_MS = 10000;
export const AVAILABLE_UPDATE_INTERVAL_MS = 60000;
export const MIN_DISTANCE_UPDATE_METERS = 20;

export function isInBoundingBox(centerLat: number, centerLng: number, targetLat: number, targetLng: number, radiusKm: number): boolean {
    const d = calculateDistance(centerLat, centerLng, targetLat, targetLng);
    return d <= radiusKm;
}
