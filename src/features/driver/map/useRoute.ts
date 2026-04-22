import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DIRECTIONS_API_BASE,
  GOOGLE_MAPS_API_KEY,
} from './constants';
import { Coordinate, RouteData, RideStatus, UseRouteOptions, UseRouteResult } from './types';
import { decodePolyline, interpolateCoordinates } from './utils';

// ─── Helpers ──────────────────────────────────────────────────────────────

function coordKey(c: Coordinate): string {
  return `${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`;
}

async function fetchSegment(
  origin: Coordinate,
  destination: Coordinate,
): Promise<Coordinate[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    // Return smooth interpolated fallback when no API key is configured
    return interpolateCoordinates(origin, destination, 20);
  }

  const url = `${DIRECTIONS_API_BASE}?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}&mode=driving`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Directions request failed: ${res.status}`);
  }

  const json = await res.json();

  if (json.status !== 'OK' || !json.routes?.length) {
    throw new Error(`Directions API error: ${json.status}`);
  }

  const encoded: string = json.routes[0].overview_polyline.points;
  return decodePolyline(encoded);
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useRoute({
  pickupLocation,
  destination,
  driverLocation,
  rideStatus,
}: UseRouteOptions): UseRouteResult {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /** Track the most recent fetch so stale responses are discarded */
  const fetchIdRef = useRef<number>(0);

  const fetchRoutes = useCallback(async (): Promise<void> => {
    const currentId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);

    try {
      // Decide which segments we need based on ride status
      const needsDriverToPickup =
        rideStatus === 'incoming_request' ||
        rideStatus === 'accepted' ||
        rideStatus === 'on_trip';

      const needsPickupToDestination =
        rideStatus === 'incoming_request' || rideStatus === 'on_trip';

      const [driverToPickup, pickupToDestination] = await Promise.all([
        needsDriverToPickup
          ? fetchSegment(driverLocation, pickupLocation)
          : Promise.resolve([] as Coordinate[]),
        needsPickupToDestination
          ? fetchSegment(pickupLocation, destination)
          : Promise.resolve([] as Coordinate[]),
      ]);

      // Discard result if a newer fetch has started
      if (currentId !== fetchIdRef.current) return;

      setRouteData({ driverToPickup, pickupToDestination });
    } catch (err) {
      if (currentId !== fetchIdRef.current) return;
      setError(
        err instanceof Error ? err.message : 'Failed to fetch route data',
      );
    } finally {
      if (currentId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    // Stringify coords to avoid reference-equality thrashing
    coordKey(pickupLocation),     // eslint-disable-line react-hooks/exhaustive-deps
    coordKey(destination),        // eslint-disable-line react-hooks/exhaustive-deps
    // coordKey(driverLocation),     // eslint-disable-line react-hooks/exhaustive-deps
    rideStatus,
  ]);

  useEffect(() => {
    void fetchRoutes();
  }, [fetchRoutes]);

  return { routeData, loading, error, refetch: fetchRoutes };
}
