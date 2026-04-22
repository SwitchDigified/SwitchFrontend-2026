import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Geolocation from '@react-native-community/geolocation';
import type {
  GeolocationError,
  GeolocationResponse
} from '@react-native-community/geolocation';
import {
  setDriverCurrentLocation,
  setDriverTrackingState,
  setDriverLocationError,
  setSyncingState,
  setLastSyncedAt,
  DriverLiveLocation
} from '../store/driverLocationSlice';
import { syncDriverLiveLocation } from '../services/driverLocationService';
import type { RootState } from '../store';

/**
 * Geohash precision levels and their approximate coverage
 * Precision 8 ≈ 19m x 19m cells (good balance)
 */
const GEOHASH_PRECISION = 8;
const MIN_DISTANCE_THRESHOLD = 2; // meters
const SYNC_INTERVAL_MS = 10000;

interface LocationCoords {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  heading: number;
  speed: number;
  timestamp: number;
}

interface LocationTrackingState {
  coords: LocationCoords | null;
  geohash: string | null;
  error: GeolocationError | null;
  isLoading: boolean;
  isTracking: boolean;
}

interface LocationTrackingOptions {
  driverId?: string; // Optional driver ID for syncing to Firestore
  isOnline?: boolean; // Driver online status
  isAvailable?: boolean; // Driver availability status
  activeRideId?: string | null; // Current ride ID if any
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceThreshold?: number;
  onLocationChange?: (state: LocationTrackingState) => void;
  onError?: (error: GeolocationError) => void;
}

/**
 * Simple geohash implementation
 * Encodes latitude/longitude to geohash string
 */
function encodeGeohash(lat: number, lon: number, precision: number = 8): string {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90,
    latMax = 90;
  let lonMin = -180,
    lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (lon > lonMid) {
        idx = (idx << 1) + 1;
        lonMin = lonMid;
      } else {
        idx = idx << 1;
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat > latMid) {
        idx = (idx << 1) + 1;
        latMin = latMid;
      } else {
        idx = idx << 1;
        latMax = latMid;
      }
    }

    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += base32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

/**
 * Calculates distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Custom hook for tracking device location with distance-based filtering and Firestore sync
 *
 * @param options Configuration options for location tracking
 * @returns Location tracking state and control methods
 *
 * @example
 * const location = useLocationTracking({
 *   driverId: 'driver123',
 *   isOnline: true,
 *   isAvailable: true,
 *   enableHighAccuracy: true,
 *   distanceThreshold: 2,
 *   onLocationChange: (state) => console.log('Location updated:', state)
 * });
 */
export function useLocationTracking(
  options: LocationTrackingOptions = {}
): LocationTrackingState & {
  startTracking: () => void;
  stopTracking: () => void;
  clearError: () => void;
} {
  const dispatch = useDispatch();
  const driverLocation = useSelector((state: RootState) => state.driverLocation);

  const {
    driverId,
    isOnline = driverLocation.isOnline,
    isAvailable = driverLocation.isAvailable,
    activeRideId = driverLocation.activeRideId,
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 0,
    distanceThreshold = MIN_DISTANCE_THRESHOLD,
    onLocationChange,
    onError
  } = options;

  const [state, setState] = useState<LocationTrackingState>({
    coords: null,
    geohash: null,
    error: null,
    isLoading: false,
    isTracking: false
  });

  const watchIdRef = useRef<number | null>(null);
  const lastCoordinatesRef = useRef<{ lat: number; lon: number } | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncAtRef = useRef<number>(0);
  const pendingSyncLocationRef = useRef<DriverLiveLocation | null>(null);

  /**
   * Syncs location to Firestore via API
   */
  const syncLocationToFirestore = useCallback(
    async (location: DriverLiveLocation) => {
      if (!driverId) {
        console.warn('[useLocationTracking] No driverId provided, skipping Firestore sync');
        return;
      }

      try {
        dispatch(setSyncingState(true));

        await syncDriverLiveLocation({
          driverId,
          location,
          isOnline,
          isAvailable,
          activeRideId: activeRideId ?? null
        });

        dispatch(setLastSyncedAt(new Date().toISOString()));
        console.log('[useLocationTracking] Successfully synced location to Firestore:', {
          driverId,
          lat: location.latitude,
          lng: location.longitude,
          geohash: location.geohash
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to sync location';
        console.error('[useLocationTracking] Firestore sync error:', errorMessage);
        dispatch(setDriverLocationError(errorMessage));
      } finally {
        dispatch(setSyncingState(false));
      }
    },
    [driverId, isOnline, isAvailable, activeRideId, dispatch]
  );

  /**
   * Throttle Firestore sync to at most once per interval while guaranteeing
   * the latest location is eventually sent (trailing sync).
   */
  const scheduleLocationSync = useCallback(
    (location: DriverLiveLocation) => {
      pendingSyncLocationRef.current = location;

      const now = Date.now();
      const elapsed = now - lastSyncAtRef.current;

      if (elapsed >= SYNC_INTERVAL_MS) {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
          syncTimeoutRef.current = null;
        }

        const locationToSync = pendingSyncLocationRef.current;
        pendingSyncLocationRef.current = null;
        lastSyncAtRef.current = now;

        if (locationToSync) {
          console.log('[useLocationTracking] Syncing location immediately');
          syncLocationToFirestore(locationToSync);
        }
        return;
      }

      if (syncTimeoutRef.current !== null) {
        return;
      }

      const delay = SYNC_INTERVAL_MS - elapsed;
      syncTimeoutRef.current = setTimeout(() => {
        syncTimeoutRef.current = null;

        const locationToSync = pendingSyncLocationRef.current;
        pendingSyncLocationRef.current = null;
        lastSyncAtRef.current = Date.now();

        if (locationToSync) {
          console.log('[useLocationTracking] Running trailing throttled sync');
          syncLocationToFirestore(locationToSync);
        }
      }, delay);
    },
    [syncLocationToFirestore]
  );

  /**
   * Handle successful position update
   */
  const handlePositionSuccess = useCallback(
    (position: GeolocationResponse) => {
      const { latitude, longitude, ...rest } = position.coords;

      console.log('[useLocationTracking] Position received:', {
        lat: latitude,
        lng: longitude,
        accuracy: rest.accuracy,
        timestamp: new Date(position.timestamp).toISOString()
      });

      // Check if we've moved more than the distance threshold
      if (lastCoordinatesRef.current) {
        const distance = calculateDistance(
          lastCoordinatesRef.current.lat,
          lastCoordinatesRef.current.lon,
          latitude,
          longitude
        );

        console.log('[useLocationTracking] Distance since last update:', {
          distance: distance.toFixed(2),
          threshold: distanceThreshold,
          skipped: distance < distanceThreshold
        });

        if (distance < distanceThreshold) {
          console.log('[useLocationTracking] Skipping update - movement below threshold');
          return; // Skip update if movement is below threshold
        }
      }

      // Update last known coordinates
      lastCoordinatesRef.current = { lat: latitude, lon: longitude };

      // Create normalized coords object
      const coords: LocationCoords = {
        latitude,
        longitude,
        altitude: rest.altitude ?? null,
        accuracy: rest.accuracy,
        altitudeAccuracy: rest.altitudeAccuracy ?? null,
        heading: rest.heading ?? 0,
        speed: rest.speed ?? 0,
        timestamp: position.timestamp
      };

      // Generate geohash
      const geohash = encodeGeohash(latitude, longitude, GEOHASH_PRECISION);

      // Create DriverLiveLocation with all required fields
      const liveLocation: DriverLiveLocation = {
        latitude,
        longitude,
        heading: coords.heading || null,
        speed: coords.speed || null,
        accuracy: coords.accuracy,
        geohash,
        updatedAt: new Date().toISOString()
      };

      // Update local state
      const newState: LocationTrackingState = {
        coords,
        geohash,
        error: null,
        isLoading: false,
        isTracking: true
      };

      setState(newState);

      // Dispatch to Redux
      dispatch(setDriverCurrentLocation(liveLocation));
      dispatch(setDriverTrackingState(true));

      // Trigger callback
      onLocationChange?.(newState);

      // Throttle Firestore sync (max once every 10 seconds, with trailing sync).
      scheduleLocationSync(liveLocation);
    },
    [distanceThreshold, onLocationChange, dispatch, scheduleLocationSync]
  );

  /**
   * Handle position error
   */
  const handlePositionError = useCallback(
    (error: GeolocationError) => {
      console.error('[useLocationTracking] Position error:', {
        code: error.code,
        message: error.message
      });

      const newState: LocationTrackingState = {
        ...state,
        error,
        isLoading: false
      };

      setState(newState);
      dispatch(setDriverLocationError(error.message));
      onError?.(error);
    },
    [state, onError, dispatch]
  );

  /**
   * Start location tracking
   */
  const startTracking = useCallback(() => {
    // Don't start if already tracking
    if (watchIdRef.current !== null) {
      console.log('[useLocationTracking] Already tracking, ignoring start request');
      return;
    }

    console.log('[useLocationTracking] Starting location tracking with options:', {
      enableHighAccuracy,
      timeout,
      maximumAge,
      driverId,
      distanceThreshold
    });

    setState(prev => ({ ...prev, isLoading: true }));
    dispatch(setDriverTrackingState(true));

    watchIdRef.current = Geolocation.watchPosition(
      handlePositionSuccess,
      handlePositionError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge
      }
    );

    console.log('[useLocationTracking] Watch ID assigned:', watchIdRef.current);
  }, [
    enableHighAccuracy,
    timeout,
    maximumAge,
    driverId,
    distanceThreshold,
    handlePositionSuccess,
    handlePositionError,
    dispatch
  ]);

  /**
   * Stop location tracking
   */
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      lastCoordinatesRef.current = null;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      pendingSyncLocationRef.current = null;
      lastSyncAtRef.current = 0;

      setState(prev => ({
        ...prev,
        isTracking: false,
        isLoading: false
      }));

      dispatch(setDriverTrackingState(false));

      console.log('[useLocationTracking] Stopped tracking location');
    }
  }, [dispatch]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }));

    dispatch(setDriverLocationError(null));
  }, [dispatch]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      pendingSyncLocationRef.current = null;
    };
  }, []);

  return useMemo(
    () => ({
      ...state,
      startTracking,
      stopTracking,
      clearError
    }),
    [state, startTracking, stopTracking, clearError]
  );
}

export type { LocationCoords, LocationTrackingState, LocationTrackingOptions };
