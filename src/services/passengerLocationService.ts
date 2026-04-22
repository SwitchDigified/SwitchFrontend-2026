/**
 * Passenger Location Service
 * Manages synchronization of passenger location and status to Firestore
 * Uses @react-native-firebase for compatibility
 */

import firestore from '@react-native-firebase/firestore';
import type { GeolocationResponse } from '@react-native-community/geolocation';
import type { PassengerLiveLocation } from '../store/passengerLocationSlice';
import {
  buildPassengerLocationPayload,
  type PassengerLocationPayload,
} from '../utils/passengerLocation/payloadBuilder';
import { encodeGeohash } from '../utils/geohash';

const PASSENGER_LOCATIONS_COLLECTION = 'passenger_locations';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const requirePassengerId = (passengerId: string): string => {
  const normalizedPassengerId = passengerId.trim();
  if (!normalizedPassengerId) {
    throw new Error('Cannot sync passenger location without a valid passenger id');
  }
  return normalizedPassengerId;
};

const sanitizePassengerPayload = (payload: PassengerLocationPayload): PassengerLocationPayload => {
  const sanitized: PassengerLocationPayload = {
    passengerId: payload.passengerId,
    isOnline: payload.isOnline,
    isWaitingForRide: payload.isWaitingForRide,
    activeRideId: payload.activeRideId ?? null,
    updatedAt: payload.updatedAt,
  };

  if (isFiniteNumber(payload.latitude)) {
    sanitized.latitude = payload.latitude;
  }

  if (isFiniteNumber(payload.longitude)) {
    sanitized.longitude = payload.longitude;
  }

  if (typeof payload.geohash === 'string' && payload.geohash.trim().length > 0) {
    sanitized.geohash = payload.geohash;
  }

  if (payload.heading === null || isFiniteNumber(payload.heading)) {
    sanitized.heading = payload.heading ?? null;
  }

  if (payload.speed === null || isFiniteNumber(payload.speed)) {
    sanitized.speed = payload.speed ?? null;
  }

  if (payload.accuracy === null || isFiniteNumber(payload.accuracy)) {
    sanitized.accuracy = payload.accuracy ?? null;
  }

  return sanitized;
};

/**
 * Syncs passenger online/waiting status to passenger_locations
 * Called when passenger goes online/offline or starts/stops waiting
 */
export const syncPassengerPresence = async (payload: {
  passengerId: string;
  isOnline: boolean;
  isWaitingForRide: boolean;
  activeRideId: string | null;
  updatedAt: string;
  location?: PassengerLiveLocation | null;
}): Promise<void> => {
  try {
    const passengerId = requirePassengerId(payload.passengerId);
    const passengerLocationRef = firestore()
      .collection(PASSENGER_LOCATIONS_COLLECTION)
      .doc(passengerId);

    const firestorePayload = buildPassengerLocationPayload({
      passengerId,
      isOnline: payload.isOnline,
      isWaitingForRide: payload.isWaitingForRide,
      activeRideId: payload.activeRideId,
      updatedAt: payload.updatedAt,
      location: payload.location,
    });

    await passengerLocationRef.set(sanitizePassengerPayload(firestorePayload), { merge: true });
  } catch (error) {
    console.error('Error syncing passenger presence:', error);
    throw error;
  }
};

/**
 * Syncs passenger live location (lat/lng) to passenger_locations
 * Called frequently during location tracking (every 5-10 seconds)
 */
export const syncPassengerLiveLocation = async (
  passengerId: string,
  geolocation: GeolocationResponse,
  geohash?: string
): Promise<void> => {
  try {
    const safePassengerId = requirePassengerId(passengerId);
    const latitude = geolocation.coords.latitude;
    const longitude = geolocation.coords.longitude;

    if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
      throw new Error('Passenger location update skipped due to invalid coordinates');
    }

    const passengerLocationRef = firestore()
      .collection(PASSENGER_LOCATIONS_COLLECTION)
      .doc(safePassengerId);

    const geohashValue = geohash || encodeGeohash(
      latitude,
      longitude
    );

    const location: PassengerLiveLocation = {
      latitude,
      longitude,
      geohash: geohashValue,
      heading: isFiniteNumber(geolocation.coords.heading) ? geolocation.coords.heading : null,
      speed: isFiniteNumber(geolocation.coords.speed) ? geolocation.coords.speed : null,
      accuracy: isFiniteNumber(geolocation.coords.accuracy) ? geolocation.coords.accuracy : null,
      updatedAt: new Date().toISOString(),
    };

    const payload = buildPassengerLocationPayload({
      passengerId: safePassengerId,
      isOnline: true,
      isWaitingForRide: false,
      activeRideId: null,
      updatedAt: location.updatedAt,
      location,
    });

    await passengerLocationRef.set(sanitizePassengerPayload(payload), { merge: true });
  } catch (error) {
    console.error('Error syncing passenger live location:', error);
    throw error;
  }
};

/**
 * Sets passenger to offline state in passenger_locations
 * Clears location data and status when passenger goes offline
 */
export const setPassengerOfflineState = async (
  passengerId: string
): Promise<void> => {
  try {
    const safePassengerId = requirePassengerId(passengerId);
    const passengerLocationRef = firestore()
      .collection(PASSENGER_LOCATIONS_COLLECTION)
      .doc(safePassengerId);

    await passengerLocationRef.update({
      isOnline: false,
      isWaitingForRide: false,
      activeRideId: null,
      // Don't clear location data - keep last known location for reference
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Error setting passenger offline state:', error);
    throw error;
  }
};

/**
 * Updates passenger ride status in passenger_locations
 * Called when passenger requests a ride or ride completes
 */
export const updatePassengerRideStatus = async (
  passengerId: string,
  isWaitingForRide: boolean,
  activeRideId: string | null
): Promise<void> => {
  try {
    const safePassengerId = requirePassengerId(passengerId);
    const passengerLocationRef = firestore()
      .collection(PASSENGER_LOCATIONS_COLLECTION)
      .doc(safePassengerId);

    await passengerLocationRef.update({
      isWaitingForRide,
      activeRideId,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating passenger ride status:', error);
    throw error;
  }
};

/**
 * Creates initial passenger_locations document during signup
 * Must be called after passenger is created in passengers collection
 */
export const createInitialPassengerLocationDoc = async (
  passengerId: string,
  updatedAt: string
): Promise<void> => {
  try {
    const safePassengerId = requirePassengerId(passengerId);
    const passengerLocationRef = firestore()
      .collection(PASSENGER_LOCATIONS_COLLECTION)
      .doc(safePassengerId);

    const initialPayload: PassengerLocationPayload = {
      passengerId: safePassengerId,
      isOnline: false,
      isWaitingForRide: false,
      activeRideId: null,
      updatedAt,
    };

    await passengerLocationRef.set(sanitizePassengerPayload(initialPayload));
  } catch (error) {
    console.error('Error creating initial passenger location document:', error);
    throw error;
  }
};

/**
 * Retrieves passenger live location from passenger_locations
 * Used for debugging or fetching current state
 */
export const getPassengerLocation = async (
  passengerId: string
): Promise<PassengerLocationPayload | null> => {
  try {
    const safePassengerId = requirePassengerId(passengerId);
    const snapshot = await firestore()
      .collection(PASSENGER_LOCATIONS_COLLECTION)
      .doc(safePassengerId)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as PassengerLocationPayload;
  } catch (error) {
    console.error('Error retrieving passenger location:', error);
    throw error;
  }
};
