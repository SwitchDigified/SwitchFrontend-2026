import { Coordinate } from './types';

/**
 * Decodes a Google Maps encoded polyline string into an array of coordinates.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): Coordinate[] {
  const coordinates: Coordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coordinates;
}

/**
 * Returns the bounding region that fits all provided coordinates with padding.
 */
export function getBoundingRegion(
  coordinates: Coordinate[],
  paddingFactor = 0.15,
) {
  if (coordinates.length === 0) {
    return null;
  }

  const latitudes = coordinates.map((c) => c.latitude);
  const longitudes = coordinates.map((c) => c.longitude);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const latDelta = (maxLat - minLat) * (1 + paddingFactor) || 0.02;
  const lngDelta = (maxLng - minLng) * (1 + paddingFactor) || 0.02;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(latDelta, 0.01),
    longitudeDelta: Math.max(lngDelta, 0.01),
  };
}

/**
 * Generates intermediate waypoints between two coordinates for a
 * visually smooth straight-line fallback polyline.
 */
export function interpolateCoordinates(
  from: Coordinate,
  to: Coordinate,
  steps = 12,
): Coordinate[] {
  const coords: Coordinate[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    coords.push({
      latitude: from.latitude + (to.latitude - from.latitude) * t,
      longitude: from.longitude + (to.longitude - from.longitude) * t,
    });
  }
  return coords;
}
