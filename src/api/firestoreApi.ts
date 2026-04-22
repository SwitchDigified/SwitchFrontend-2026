import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

import { db } from '../config/firebase';
import type { DriverLiveLocation } from '../store/driverLocationSlice';
import type { PassengerLiveLocation } from '../store/passengerLocationSlice';

const PASSENGERS_COLLECTION = 'passengers';
const RIDES_COLLECTION = 'rides';

const passengersCollection = collection(db, PASSENGERS_COLLECTION);
const ridesCollection = collection(db, RIDES_COLLECTION);

// ============================================================================
// TYPES - For Joe's implementation
// ============================================================================

export type StoredUserRole = 'passenger' | 'driver';

export type DriverPresenceWritePayload = {
  driverId: string;
  lat: number;
  lng: number;
  geohash: string;
  isOnline: boolean;
  isAvailable: boolean;
  activeRideId: string | null;
  updatedAt: string;
};

export type PassengerPresenceWritePayload = {
  passengerId: string;
  isOnline: boolean;
  isWaitingForRide: boolean;
  activeRideId: string | null;
  updatedAt: string;
  location?: PassengerLiveLocation | null;
};

export type PassengerRideDoc = { id: string; data: FirebaseFirestoreTypes.DocumentData };

// ============================================================================
// FIRESTORE SUBSCRIPTIONS - For Joe
// ============================================================================

/**
 * Subscribe to real-time updates of all rides for a passenger
 * Fires whenever any ride document matching the passenger changes
 *
 * @param passengerId - The UID of the passenger
 * @param onNext - Callback fired whenever rides data changes
 * @param onError - Optional error callback
 * @returns Unsubscribe function — call it to stop listening
 */
export const subscribePassengerRideDocuments = (
  passengerId: string,
  onNext: (docs: PassengerRideDoc[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const ridesQuery = query(ridesCollection, where('passengerId', '==', passengerId));

  return onSnapshot(
    ridesQuery,
    (snapshot) => {
      onNext(snapshot.docs.map((docItem) => ({ id: docItem.id, data: docItem.data() })));
    },
    (error) => {
      onError?.(error);
    }
  );
};

/**
 * Subscribe to real-time updates of a passenger profile document in Firestore.
 * Fires whenever the passenger's profile data changes.
 *
 * @param passengerId - The UID of the passenger
 * @param onNext - Callback fired whenever the passenger data changes
 * @param onError - Optional error callback
 * @returns Unsubscribe function — call it to stop listening
 */
export const subscribePassengerProfileDocument = (
  passengerId: string,
  onNext: (data: FirebaseFirestoreTypes.DocumentData) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const passengerDocRef = doc(passengersCollection, passengerId);

  return onSnapshot(
    passengerDocRef,
    (snapshot) => {
      if (snapshot.exists) {
        onNext(snapshot.data() || {});
      }
    },
    (error) => {
      onError?.(error);
    }
  );
};
