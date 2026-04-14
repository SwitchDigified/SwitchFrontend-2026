import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Geolocation from '@react-native-community/geolocation';
import type {
  GeolocationError,
  GeolocationResponse
} from '@react-native-community/geolocation';
import type { LatLng } from 'react-native-maps';

import type { RideRequestRoute } from '../../../components/maps';
import { logout, updateDriverSessionLocation } from '../../../store/authSlice';
import {
  DriverLiveLocation,
  resetDriverLocationState,
  setDriverCurrentLocation,
  setDriverLocationError,
  setDriverOnlineState,
  setDriverTrackingState
} from '../../../store/driverLocationSlice';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  setDriverOfflineState,
  syncDriverLiveLocation,
  syncDriverPresence
} from '../../../services/driverLocationService';
import { encodeGeohash } from '../../../utils/geohash';

const SAMPLE_RIDE_REQUEST: RideRequestRoute = {
  pickupLocation: { latitude: 9.05785, longitude: 7.49508 },
  destinationLocation: { latitude: 9.04104, longitude: 7.48948 }
};

const LOCATION_DISTANCE_THRESHOLD_IN_METERS = 2;

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceInMeters = (from: LatLng, to: LatLng) => {
  const earthRadius = 6371000;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const startLat = toRadians(from.latitude);
  const endLat = toRadians(to.latitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildDriverLiveLocation = (position: GeolocationResponse): DriverLiveLocation => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
  speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
  accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
  geohash: encodeGeohash(position.coords.latitude, position.coords.longitude),
  updatedAt: new Date(position.timestamp).toISOString()
});

export function useDriverHomeState() {
  const dispatch = useAppDispatch();
  const { session } = useAppSelector((state) => state.auth);
  const { currentLocation, isOnline, isTracking } = useAppSelector((state) => state.driverLocation);

  const [rideRequest, setRideRequest] = useState<RideRequestRoute | null>(null);
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastProcessedLocationRef = useRef<DriverLiveLocation | null>(null);
  const lastSyncedLocationRef = useRef<DriverLiveLocation | null>(null);
  const syncLocationRef = useRef<(location: DriverLiveLocation) => Promise<void>>(async () => {});

  // Track whether the watcher has been started at least once
  const watchStartedRef = useRef(false);

  const initials = useMemo(() => {
    if (!session) return 'DR';
    const first = session.user.firstName?.[0] ?? '';
    const last = session.user.lastName?.[0] ?? '';
    const value = `${first}${last}`.toUpperCase();
    return value.length > 0 ? value : 'DR';
  }, [session]);

  const onToggleOnline = useCallback(async () => {
    if (!session || session.user.role !== 'driver' || isTogglingOnline) return;

    const next = !isOnline;
    setIsTogglingOnline(true);

    try {
      await syncDriverPresence({
        driverId: session.user.id,
        isOnline: next,
        isAvailable: next && !rideRequest,
        activeRideId: null,
        location: currentLocation
      });

      dispatch(setDriverOnlineState(next));

      if (!next) {
        setRideRequest(null);
      }
    } catch (error) {
      dispatch(
        setDriverLocationError(
          error instanceof Error ? error.message : 'Unable to update driver online state'
        )
      );
    } finally {
      setIsTogglingOnline(false);
    }
  }, [currentLocation, dispatch, isOnline, isTogglingOnline, rideRequest, session]);

  const onToggleRideRequestPreview = useCallback(() => {
    if (!isOnline) return;
    setRideRequest((current) => (current ? null : SAMPLE_RIDE_REQUEST));
  }, [isOnline]);

  const onLogout = useCallback(() => {
    if (session?.user.role === 'driver') {
      void setDriverOfflineState(session.user.id).catch(() => undefined);
    }
    dispatch(resetDriverLocationState());
    dispatch(logout());
  }, [dispatch, session]);

  // Seed Redux with last known location from session on mount
  useEffect(() => {
    if (!session || session.user.role !== 'driver') return;

    if (!currentLocation && session.user.lastKnownLocation) {
      const location: DriverLiveLocation = {
        latitude: session.user.lastKnownLocation.lat,
        longitude: session.user.lastKnownLocation.lng,
        heading: null,
        speed: null,
        accuracy: null,
        geohash: encodeGeohash(
          session.user.lastKnownLocation.lat,
          session.user.lastKnownLocation.lng
        ),
        updatedAt: session.user.lastLocationUpdatedAt ?? session.user.updatedAt
      };
      
      dispatch(setDriverCurrentLocation(location));
      lastProcessedLocationRef.current = location;
      lastSyncedLocationRef.current = location;
    }
  }, [currentLocation, dispatch, session]);

  // Effect 1: Keep syncLocationRef current without restarting the watcher.
  useEffect(() => {
    syncLocationRef.current = async (location: DriverLiveLocation) => {
      const previousLocation = lastSyncedLocationRef.current;
      const movedEnough = previousLocation
        ? calculateDistanceInMeters(previousLocation, location) >= LOCATION_DISTANCE_THRESHOLD_IN_METERS
        : true;

      if (!movedEnough) return;

      lastSyncedLocationRef.current = location;
      
      await syncDriverLiveLocation({
        driverId: session!.user.id,
        location,
        isOnline: true,
        isAvailable: !rideRequest,
        activeRideId: null
      });
    };
  }, [dispatch, rideRequest, session]);

  // Effect 2: Start the geolocation watcher ONCE on mount.
  useEffect(() => {
    if (!session || session.user.role !== 'driver') return;
    if (watchStartedRef.current) return;

    watchStartedRef.current = true;

    const handlePositionSuccess = (position: GeolocationResponse) => {
      const newLocation = buildDriverLiveLocation(position);
      
      // MANUAL DISTANCE CHECK - Workaround for unreliable distanceFilter on Android
      const lastLocation = lastProcessedLocationRef.current;
      const distanceMoved = lastLocation
        ? calculateDistanceInMeters(lastLocation, newLocation)
        : Infinity;
      
      // Only process if moved enough or it's the first location
      if (distanceMoved >= LOCATION_DISTANCE_THRESHOLD_IN_METERS || !lastLocation) {
        // Update the last processed location
        lastProcessedLocationRef.current = newLocation;
        
        // Update Redux with the new location
        dispatch(setDriverCurrentLocation(newLocation));
        dispatch(
          updateDriverSessionLocation({
            lat: newLocation.latitude,
            lng: newLocation.longitude,
            updatedAt: newLocation.updatedAt
          })
        );
        
        dispatch(setDriverTrackingState(true));
        dispatch(setDriverLocationError(null));
        
        // Only sync to Firestore when online
        if (isOnlineRef.current) {
          void syncLocationRef.current(newLocation).catch((error) => {
            dispatch(
              setDriverLocationError(
                error instanceof Error ? error.message : 'Unable to sync driver location'
              )
            );
          });
        }
        
        // Log only when actually updated (for debugging)
        if (__DEV__ && distanceMoved > 0) {
          console.log(`Location updated - moved ${distanceMoved.toFixed(2)} meters`);
        }
      } else if (__DEV__ && distanceMoved > 0) {
        // Optional: log ignored updates for debugging
        console.log(`Location ignored - moved only ${distanceMoved.toFixed(2)} meters`);
      }
    };

    const handlePositionError = (error: GeolocationError) => {
      dispatch(setDriverTrackingState(false));
      dispatch(setDriverLocationError(error.message));
    };

    // One-shot fix so the map shows a pin immediately
    Geolocation.getCurrentPosition(handlePositionSuccess, handlePositionError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    });

    // Configure watcher with better Android compatibility
    // Remove distanceFilter as it's unreliable on many Android devices
    // We'll handle distance filtering manually in the callback
    watchIdRef.current = Geolocation.watchPosition(handlePositionSuccess, handlePositionError, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 20000
      // Note: distanceFilter is REMOVED because it doesn't work reliably on Android
      // We handle distance filtering manually in the callback above
    });

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      watchStartedRef.current = false;
      dispatch(setDriverTrackingState(false));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, session]);

  // Effect 3: Mirror isOnline into a ref so the watcher callback always reads
  // the latest value without the watcher ever needing to restart.
  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;

    if (!isOnline && session?.user.role === 'driver') {
      void setDriverOfflineState(session.user.id).catch(() => undefined);
    }
  }, [isOnline, session]);

  return {
    session,
    driverLocation: currentLocation,
    isOnline,
    isTracking,
    rideRequest,
    initials,
    isTogglingOnline,
    onToggleOnline,
    onToggleRideRequestPreview,
    onLogout
  };
}