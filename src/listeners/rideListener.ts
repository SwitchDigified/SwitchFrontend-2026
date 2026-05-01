import {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { subscribePassengerRideDocuments } from '../api/firestoreApi';
import type {
  RideCancelledBy,
  RideLocation,
  RideParticipantDriver,
  RideParticipantRider,
  RideRequest,
  RideSchedule,
  RideStatus,
  RideType,
} from '../types/ride';

type FirestoreTimestampLike = FirebaseFirestoreTypes.Timestamp | Date | string | null | undefined;

type FirestoreRide = {
  passengerId?: string;
  driver?: RideParticipantDriver | string | null;
  pickupLocation?: RideLocation;
  stopLocation?: RideLocation | null;
  destinationLocation?: RideLocation;
  status?: string | null;
  cancelBy?: RideCancelledBy;
  rideType?: RideType;
  paymentMethod?: string;
  rider?: RideParticipantRider;
  schedule?: {
    type?: RideSchedule['type'];
    pickupAt?: string;
    scheduledTime?: string;
  } | null;
  createdAt?: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
};

const TERMINAL_STATUSES: RideStatus[] = ['completed', 'cancelled'];
const isTimestamp = (
  value: FirestoreTimestampLike,
): value is FirebaseFirestoreTypes.Timestamp =>
  value != null &&
  typeof value === 'object' &&
  'toDate' in value &&
  typeof value.toDate === 'function';

const toIsoString = (value: FirestoreTimestampLike): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isTimestamp(value)) {
    return value.toDate().toISOString();
  }

  return new Date().toISOString();
};

const normalizeRideStatus = (value: string | null | undefined): RideStatus => {
  switch (value?.trim().toLowerCase()) {
    case 'accepted':
      return 'accepted';
    case 'arrived':
      return 'arrived';
    case 'on_trip':
    case 'on_ride':
      return 'on_trip';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'exhausted':
      return 'exhausted';
    case 'requested':
    case 'requesting':
    case 'searching_driver':
      return 'requested';
    default:
      return 'idle';
  }
};

const normalizeRideSchedule = (
  schedule: FirestoreRide['schedule'],
): RideSchedule => {
  if (schedule?.type === 'later') {
    return {
      type: 'later',
      pickupAt: schedule.pickupAt ?? schedule.scheduledTime,
    };
  }

  return { type: 'now' };
};

const normalizeRideDriver = (
  driver: FirestoreRide['driver'],
): RideParticipantDriver | null => {
  if (!driver || typeof driver === 'string') {
    return null;
  }

  return driver;
};

const normalizeRideCancelledBy = (
  value: FirestoreRide['cancelBy'],
): RideCancelledBy => {
  if (value === 'passenger' || value === 'driver') {
    return value;
  }

  return null;
};

const normalizeRide = (
  id: string,
  ride: FirestoreRide,
): RideRequest => ({
  id,
  passengerId: ride.passengerId ?? '',
  rideType: ride.rideType ?? 'single',
  status: normalizeRideStatus(ride.status),
  cancelBy: normalizeRideCancelledBy(ride.cancelBy),
  pickupLocation: ride.pickupLocation ?? {
    address: '',
    coordinates: { latitude: 0, longitude: 0 },
  },
  stopLocation: ride.stopLocation ?? undefined,
  destinationLocation: ride.destinationLocation ?? {
    address: '',
    coordinates: { latitude: 0, longitude: 0 },
  },
  paymentMethod: ride.paymentMethod ?? 'cash',
  rider: ride.rider ?? {
    id: ride.passengerId ?? '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  },
  driver: normalizeRideDriver(ride.driver),
  schedule: normalizeRideSchedule(ride.schedule),
  createdAt: toIsoString(ride.createdAt),
  updatedAt: toIsoString(ride.updatedAt),
});

// --- Listeners ---

/**
 * Listens to all rides belonging to a passenger in real-time.
 * Uses the modular @react-native-firebase/firestore v22 API.
 *
 * @param passengerId - The UID of the passenger (must match Firebase auth uid)
 * @param onRidesUpdate - Callback fired whenever rides change
 * @param onError - Optional error callback
 * @returns Unsubscribe function — call it to stop listening
 */
export function listenToPassengerRides(
  passengerId: string,
  onRidesUpdate: (rides: RideRequest[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return subscribePassengerRideDocuments(
    passengerId,
    (docs) => {
      const rides = docs.map((docItem) =>
        normalizeRide(docItem.id, docItem.data as FirestoreRide),
      );

      onRidesUpdate(rides);
    },
    (error) => {
      console.error('[rideListener] Firestore error:', error);
      onError?.(error);
    },
  );
}

/**
 * Listens to the single active (non-completed/cancelled) ride for a passenger.
 */
export function listenToActivePassengerRide(
  passengerId: string,
  onRideUpdate: (ride: RideRequest | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return subscribePassengerRideDocuments(
    passengerId,
    (docs) => {
      // console.log("TEST RIDE DOCS", docs)
      const activeRides = docs
        .map((docItem) => normalizeRide(docItem.id, docItem.data as FirestoreRide))
        .filter((ride) => !TERMINAL_STATUSES.includes(ride.status));

      onRideUpdate(activeRides.length > 0 ? activeRides[0] : null);
    },
    (error) => {
      console.error('[rideListener] Firestore error:', error);
      onError?.(error);
    },
  );
}
