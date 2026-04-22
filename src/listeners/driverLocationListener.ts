import { db } from '../config/firebase';
import { collection, doc, onSnapshot, Unsubscribe } from '@react-native-firebase/firestore';
import {
  setDriverOnlineState,
  setDriverAvailableState,
  setDriverActiveRide,
  updateDriverLocationState,
} from '../store/driverLocationSlice';
import type { AppDispatch } from '../store/index';

/**
 * Firestore driver location document structure
 */
type FirestoreDriverLocation = {
  driverId?: string;
  lat?: number;
  lng?: number;
  geohash?: string;
  isOnline?: boolean;
  isAvailable?: boolean;
  activeRideId?: string | null;
  updatedAt?: string;
};

/**
 * Normalizes driver location data from Firestore
 */
const normalizeDriverLocationData = (
  id: string,
  data: FirestoreDriverLocation,
) => {
  console.log('[driverLocationListener] Normalizing driver location data:', {
    driverId: id,
    data,
  });

  return {
    driverId: data.driverId ?? id,
    isOnline: typeof data.isOnline === 'boolean' ? data.isOnline : false,
    isAvailable: typeof data.isAvailable === 'boolean' ? data.isAvailable : false,
    activeRideId: data.activeRideId ?? null,
  };
};

/**
 * Listens to driver location document in Firestore and updates Redux state
 * Fires whenever the driver location document changes
 *
 * @param driverId - The UID of the driver
 * @param dispatch - Redux dispatch function
 * @param onError - Optional error callback
 * @returns Unsubscribe function — call it to stop listening
 */
export function listenToDriverLocation(
  driverId: string,
  dispatch: AppDispatch,
  onError?: (error: Error) => void,
): Unsubscribe {
  console.log('[driverLocationListener] Setting up listener for driver:', driverId);

  const driverLocationCollection = collection(db, 'driver_locations');
  const driverLocationDocRef = doc(driverLocationCollection, driverId);

  return onSnapshot(
    driverLocationDocRef,
    (snapshot) => {
      if (snapshot.exists) {
        const data = snapshot.data() as FirestoreDriverLocation;
        
        console.log('[driverLocationListener] Firestore snapshot received:', {
          docId: snapshot.id,
          rawData: data,
          timestamp: new Date().toISOString(),
        });

        const normalized = normalizeDriverLocationData(snapshot.id, data);

        console.log('[driverLocationListener] Normalized driver location data:', normalized);

        // Dispatch individual actions for state updates
        console.log('[driverLocationListener] Dispatching Redux actions:', {
          setDriverOnlineState: normalized.isOnline,
          setDriverAvailableState: normalized.isAvailable,
          setDriverActiveRide: normalized.activeRideId,
        });

        dispatch(setDriverOnlineState(normalized.isOnline));
        dispatch(setDriverAvailableState(normalized.isAvailable));
        dispatch(setDriverActiveRide(normalized.activeRideId));

        // Also dispatch a bulk update for any other changes
        const updatePayload = {
          isOnline: normalized.isOnline,
          isAvailable: normalized.isAvailable,
          activeRideId: normalized.activeRideId,
        };

        console.log('[driverLocationListener] Dispatching bulk update to driverLocationSlice:', updatePayload);

        dispatch(updateDriverLocationState(updatePayload));

        console.log('[driverLocationListener] All Redux actions dispatched successfully ✅');
      } else {
        console.log('[driverLocationListener] Driver location document does not exist:', driverId);
      }
    },
    (error) => {
      console.error('[driverLocationListener] Firestore error:', {
        driverId,
        errorMessage: error.message,
      });
      onError?.(error);
    },
  );
}

/**
 * Sets up driver location listener with error handling
 * Useful for attaching to app initialization
 *
 * @param driverId - The UID of the driver
 * @param dispatch - Redux dispatch function
 * @returns Unsubscribe function
 */
export function setupDriverLocationListener(
  driverId: string,
  dispatch: AppDispatch,
): Unsubscribe {
  console.log('[driverLocationListener] 🚀 Setting up driver location listener:', {
    driverId,
    timestamp: new Date().toISOString(),
  });

  return listenToDriverLocation(driverId, dispatch, (error) => {
    console.error('[driverLocationListener] Setup error:', error);
  });
}
