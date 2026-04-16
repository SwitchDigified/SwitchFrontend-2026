import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  FirebaseFirestoreTypes,
  updateDoc,
} from '@react-native-firebase/firestore';

import { db } from '../config/firebase';
import type { DriverLiveLocation } from '../store/driverLocationSlice';
import type { DriverRideRequestStatus } from '../types/driverRideRequest';
import type { RideRequest } from '../types/ride';

const PASSENGERS_COLLECTION = 'passengers';
const DRIVERS_COLLECTION = 'drivers';
const DRIVER_LOCATIONS_COLLECTION = 'driver_locations';
const RIDES_COLLECTION = 'rides';
const RIDE_OFFERS_COLLECTION = 'ride_offers';

const passengersCollection = collection(db, PASSENGERS_COLLECTION);
const driversCollection = collection(db, DRIVERS_COLLECTION);
const driverLocationsCollection = collection(db, DRIVER_LOCATIONS_COLLECTION);
const ridesCollection = collection(db, RIDES_COLLECTION);
const rideOffersCollection = collection(db, RIDE_OFFERS_COLLECTION);

export type StoredUserRole = 'passenger' | 'driver';

export type DriverPresenceWritePayload = {
  driverId: string;
  isOnline: boolean;
  isAvailable: boolean;
  activeRideId: string | null;
  updatedAt: string;
  location?: DriverLiveLocation | null;
};

type RideOfferDocument = {
  id?: string;
  rideId?: string;
  driverId?: string;
  status?: string;
};

export type PassengerRideDoc = { id: string; data: FirebaseFirestoreTypes.DocumentData };

export const getPassengerProfileDoc = async (userId: string) => {
  return getDoc(doc(passengersCollection, userId));
};

export const getDriverProfileDoc = async (userId: string) => {
  return getDoc(doc(driversCollection, userId));
};

export const createPassengerProfileDoc = async (
  userId: string,
  payload: Record<string, unknown>
) => {
  await setDoc(doc(passengersCollection, userId), payload, { merge: false });
};

export const createDriverProfileDoc = async (
  userId: string,
  payload: Record<string, unknown>
) => {
  await setDoc(doc(driversCollection, userId), payload, { merge: false });
};

export const mergeDriverProfileDoc = async (
  driverId: string,
  payload: Record<string, unknown>
) => {
  await setDoc(doc(driversCollection, driverId), payload, { merge: true });
};

export const mergeUserFcmTokenDoc = async (
  role: StoredUserRole,
  userId: string,
  payload: Record<string, unknown>
) => {
  const userRef =
    role === 'passenger'
      ? doc(passengersCollection, userId)
      : doc(driversCollection, userId);
  await setDoc(userRef, payload, { merge: true });
};

export const upsertDriverPresence = async ({
  driverId,
  isOnline,
  isAvailable,
  activeRideId,
  updatedAt,
  location,
}: DriverPresenceWritePayload) => {
  // console.log(`[FirestoreApi] 🔄 UPSERT DRIVER PRESENCE START`, {
  //   driverId,
  //   isOnline,
  //   isAvailable,
  //   activeRideId,
  //   hasLocation: !!location,
  //   timestamp: updatedAt
  // });

  const startTime = Date.now();

  const driverLocationPayload = {
    driverId,
    isOnline,
    isAvailable,
    activeRideId,
    updatedAt,
    ...(location
      ? {
          lat: location.latitude,
          lng: location.longitude,
          geohash: location.geohash,
          heading: location.heading,
          speed: location.speed,
          accuracy: location.accuracy,
        }
      : {}),
  };

  const driverDocRef = doc(driversCollection, driverId);
  // console.log(`[FirestoreApi] 📝 Updating driver document: ${driverDocRef.path}`, driverLocationPayload);
  
  await updateDoc(driverDocRef, driverLocationPayload);

  

  const duration = Date.now() - startTime;
  
  // console.log(`[FirestoreApi] ✅ UPSERT DRIVER PRESENCE SUCCESS`, {
  //   driverId,
  //   isOnline,
  //   durationMs: duration,
  // });

  return driverLocationPayload;
};

export const respondToRideOfferAndDriverPresence = async (input: {
  driverId: string;
  offerId: string;
  rideId: string;
  status: DriverRideRequestStatus;
  updatedAt: string;
}) => {
  console.log('[Firestore] respondToRideOfferAndDriverPresence START', {
    driverId: input.driverId,
    offerId: input.offerId,
    rideId: input.rideId,
    status: input.status,
    updatedAt: input.updatedAt,
  });

  const offerRef = doc(rideOffersCollection, input.offerId);
  const driverRef = doc(driversCollection, input.driverId);
  const driverLocationRef = doc(driverLocationsCollection, input.driverId);
  const rideRef = doc(ridesCollection, input.rideId);

  try {
    return await runTransaction(db, async (transaction) => {
      console.log('[Firestore] Transaction START - Fetching documents...');

      const [offerSnapshot, driverSnapshot] = await Promise.all([
        transaction.get(offerRef),
        transaction.get(driverRef),
      ]);

      console.log('[Firestore] Documents fetched', {
        offerExists: offerSnapshot.exists,
        driverExists: driverSnapshot.exists,
      });

      // Validation: Offer exists
      if (!offerSnapshot.exists) {
        console.warn('[Firestore] VALIDATION FAILED: Offer does not exist', { offerId: input.offerId });
        return false;
      }

      const offerData = offerSnapshot.data() as RideOfferDocument;
      console.log('[Firestore] Offer data retrieved', { offerId: input.offerId, offerStatus: offerData?.status });

      // Validation: Offer belongs to this driver and ride
      if (!offerData || offerData.driverId !== input.driverId || offerData.rideId !== input.rideId) {
        console.warn('[Firestore] VALIDATION FAILED: Offer does not match driver or ride', {
          expectedDriverId: input.driverId,
          actualDriverId: offerData?.driverId,
          expectedRideId: input.rideId,
          actualRideId: offerData?.rideId,
        });
        return false;
      }

      // Validation: Offer is still pending
      if (offerData.status && offerData.status !== 'pending') {
        console.warn('[Firestore] VALIDATION FAILED: Offer is not pending', {
          currentStatus: offerData.status,
        });
        return false;
      }

      console.log('[Firestore] All validations passed. Updating documents...');

      // Update the offer status
      console.log('[Firestore] Updating ride_offers document...');
      transaction.update(offerRef, {
        status: input.status,
        respondedAt: input.updatedAt,
        updatedAt: input.updatedAt,
      });

      const nextActiveRideId = input.status === 'accepted' ? input.rideId : null;
      const nextIsAvailable = input.status !== 'accepted';

      const presencePayload = {
        driverId: input.driverId,
        activeRideId: nextActiveRideId,
        isAvailable: nextIsAvailable,
        updatedAt: input.updatedAt,
      };

      // Update driver profile and driver_locations with availability
      console.log('[Firestore] Updating drivers document...', presencePayload);
      transaction.set(driverRef, presencePayload, { merge: true });

      console.log('[Firestore] Updating driver_locations document...');
      transaction.set(driverLocationRef, presencePayload, { merge: true });

      // On accept: update the ride document with status + driver info
      if (input.status === 'accepted') {
        const driverData = driverSnapshot.exists ? (driverSnapshot.data() as Record<string, unknown>) : {};

        console.log('[Firestore] Updating rides document (accept only)...', {
          rideId: input.rideId,
          driverId: input.driverId,
          driverName: `${driverData.firstName} ${driverData.lastName}`,
        });

        transaction.update(rideRef, {
          status: 'accepted',
          driver: {
            id: input.driverId,
            firstName: typeof driverData.firstName === 'string' ? driverData.firstName : '',
            lastName: typeof driverData.lastName === 'string' ? driverData.lastName : '',
            phone: typeof driverData.phone === 'string' ? driverData.phone : '',
          },
          updatedAt: input.updatedAt,
        });
      }

      console.log('[Firestore] Transaction completing with result: true');
      return true;
    });
  } catch (error) {
    console.error('[Firestore] Transaction FAILED with error:', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN',
      errorStack: error instanceof Error ? error.stack : 'No stack trace',
      fullError: error,
      input,
    });
    throw error;
  }
};

export const clearDriverActiveRide = async (driverId: string, updatedAt: string) => {
  console.log('[Firestore] clearDriverActiveRide called', { driverId });

  try {
    const payload = {
      driverId,
      activeRideId: null,
      isAvailable: true,
      updatedAt,
    };

    await updateDoc(doc(driversCollection, driverId), payload);
    console.log('[Firestore] clearDriverActiveRide completed successfully', { driverId });
  } catch (error) {
    console.error('[Firestore] clearDriverActiveRide failed', {
      driverId,
      errorMessage: error instanceof Error ? error.message : String(error),
      error,
    });
    throw error;
  }
};

export const cancelRideRequestInFirestore = async ({
  rideId,
  passengerId,
}: {
  rideId: string;
  passengerId: string;
}): Promise<RideRequest> => {
  const rideRef = doc(ridesCollection, rideId);
  const passengerRef = doc(passengersCollection, passengerId);

  return runTransaction(db, async (transaction) => {
    const [rideSnapshot, passengerSnapshot] = await Promise.all([
      transaction.get(rideRef),
      transaction.get(passengerRef),
    ]);

    if (!rideSnapshot.exists) {
      throw new Error('Ride not found');
    }

    if (!passengerSnapshot.exists) {
      throw new Error('Passenger record not found');
    }

    const rideData = rideSnapshot.data() as RideRequest;

    if (rideData.passengerId !== passengerId) {
      throw new Error('You are not allowed to cancel this ride');
    }

    transaction.update(rideRef, {
      status: 'cancelled',
      cancelBy: 'passenger',
      updatedAt: serverTimestamp(),
    });

    transaction.update(passengerRef, {
      rideStatus: 'idle',
      activeRideId: null,
      updatedAt: serverTimestamp(),
    });

    return {
      ...rideData,
      id: rideSnapshot.id,
      status: 'cancelled',
      cancelBy: 'passenger',
      stopLocation: rideData.stopLocation ?? undefined,
      updatedAt: new Date().toISOString(),
    };
  });
};

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
