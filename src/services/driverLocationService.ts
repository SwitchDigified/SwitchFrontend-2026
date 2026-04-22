/**
 * Driver Location Service
 * Handles all driver location and presence synchronization with Firestore
 */

import { collection, doc, setDoc } from '@react-native-firebase/firestore';
import { db } from '../config/firebase';
import type { DriverLiveLocation } from '../store/driverLocationSlice';

const DRIVER_LOCATIONS_COLLECTION = 'driver_locations';

/**
 * Input shape for syncing driver presence
 */
export type DriverPresenceSyncInput = {
  driverId: string;
  isOnline: boolean;
  isAvailable: boolean;
  activeRideId?: string | null;
  location?: DriverLiveLocation | null;
};

/**
 * Syncs driver presence (status + optional location) to Firestore
 * Updates driver_locations collection with complete driver state
 */
export const syncDriverPresence = async ({
  driverId,
  isOnline,
  isAvailable,
  activeRideId = null,
  location = null,
}: DriverPresenceSyncInput) => {
  const updatedAt = location?.updatedAt ?? new Date().toISOString();

  // Extract lat/lng from location or use defaults
  const lat = location?.latitude ?? 0;
  const lng = location?.longitude ?? 0;
  const geohash = location?.geohash ?? '';

  const payload = {
    driverId,
    lat,
    lng,
    geohash,
    activeRideId,
    updatedAt,
  };

  console.log('[driverLocationService] syncDriverPresence - Writing directly to Firestore with payload:', payload);

  try {
    const driverLocationsCollection = collection(db, DRIVER_LOCATIONS_COLLECTION);
    const driverLocationDocRef = doc(driverLocationsCollection, driverId);
    
    console.log('[driverLocationService] syncDriverPresence - Document reference:', {
      collection: DRIVER_LOCATIONS_COLLECTION,
      docId: driverId
    });

    await setDoc(driverLocationDocRef, payload, { merge: true });

    console.log('[driverLocationService] syncDriverPresence - Firestore write success:', {
      driverId,
      lat,
      lng,
      geohash,
      updatedAt
    });
  } catch (error) {
    console.error('[driverLocationService] syncDriverPresence - Firestore write error:', {
      driverId,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      errorStack: error instanceof Error ? error.stack : undefined,
      payload
    });
    throw error;
  }
};

/**
 * Syncs driver's current location with existing status
 * Used during location watcher updates
 */
export const syncDriverLiveLocation = async ({
  driverId,
  location,
  isOnline = true,
  isAvailable,
  activeRideId = null,
}: {
  driverId: string;
  location: DriverLiveLocation;
  isOnline?: boolean;
  isAvailable: boolean;
  activeRideId?: string | null;
}) => {
  console.log('[driverLocationService] syncDriverLiveLocation called with:', {
    driverId,
    lat: location.latitude,
    lng: location.longitude,
    geohash: location.geohash,
    isOnline,
    isAvailable,
    activeRideId
  });

  await syncDriverPresence({
    driverId,
    isOnline,
    isAvailable,
    activeRideId,
    location,
  });
};

/**
 * Sets driver offline status
 * Preserves last known location in database
 */
export const setDriverOfflineState = async (
  driverId: string,
  location?: DriverLiveLocation | null,
) => {
  console.log('[driverLocationService] setDriverOfflineState called for:', driverId);

  await syncDriverPresence({
    driverId,
    isOnline: false,
    isAvailable: false,
    activeRideId: null,
    location: location ?? null,
  });
};

/**
 * Toggles driver's online status in driver_locations collection
 */
export const toggleDriverOnlineStatus = async (
  driverId: string,
  isOnline: boolean,
) => {
  const payload = {
    isOnline,
    updatedAt: new Date().toISOString(),
  };

  console.log('[driverLocationService] toggleDriverOnlineStatus called:', {
    driverId,
    isOnline,
  });

  try {
    const driverLocationsCollection = collection(db, DRIVER_LOCATIONS_COLLECTION);
    const driverLocationDocRef = doc(driverLocationsCollection, driverId);

    await setDoc(driverLocationDocRef, payload, { merge: true });

    console.log('[driverLocationService] toggleDriverOnlineStatus - Firestore write success:', {
      driverId,
      isOnline,
      updatedAt: payload.updatedAt,
    });
  } catch (error) {
    console.error('[driverLocationService] toggleDriverOnlineStatus - Firestore write error:', {
      driverId,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      payload,
    });
    throw error;
  }
};

/**
 * Toggles driver's available status in driver_locations collection
 */
export const toggleDriverAvailableStatus = async (
  driverId: string,
  isAvailable: boolean,
) => {
  const payload = {
    isAvailable,
    updatedAt: new Date().toISOString(),
  };

  console.log('[driverLocationService] toggleDriverAvailableStatus called:', {
    driverId,
    isAvailable,
  });

  try {
    const driverLocationsCollection = collection(db, DRIVER_LOCATIONS_COLLECTION);
    const driverLocationDocRef = doc(driverLocationsCollection, driverId);

    await setDoc(driverLocationDocRef, payload, { merge: true });

    console.log('[driverLocationService] toggleDriverAvailableStatus - Firestore write success:', {
      driverId,
      isAvailable,
      updatedAt: payload.updatedAt,
    });
  } catch (error) {
    console.error('[driverLocationService] toggleDriverAvailableStatus - Firestore write error:', {
      driverId,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      payload,
    });
    throw error;
  }
};

/**
 * Toggles both driver's online and available status in driver_locations collection
 */
export const toggleDriverOnlineAndAvailableStatus = async (
  driverId: string,
  isOnline: boolean,
  isAvailable: boolean,
) => {
  const payload = {
    isOnline,
    isAvailable,
    updatedAt: new Date().toISOString(),
  };

  console.log('[driverLocationService] toggleDriverOnlineAndAvailableStatus called:', {
    driverId,
    isOnline,
    isAvailable,
  });

  try {
    const driverLocationsCollection = collection(db, DRIVER_LOCATIONS_COLLECTION);
    const driverLocationDocRef = doc(driverLocationsCollection, driverId);

    await setDoc(driverLocationDocRef, payload, { merge: true });

    console.log('[driverLocationService] toggleDriverOnlineAndAvailableStatus - Firestore write success:', {
      driverId,
      isOnline,
      isAvailable,
      updatedAt: payload.updatedAt,
    });
  } catch (error) {
    console.error('[driverLocationService] toggleDriverOnlineAndAvailableStatus - Firestore write error:', {
      driverId,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      payload,
    });
    throw error;
  }
};
