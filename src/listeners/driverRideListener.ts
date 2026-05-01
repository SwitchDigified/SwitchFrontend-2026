import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, Unsubscribe, getDoc, doc } from '@react-native-firebase/firestore';
import type { RideStatus } from '../types/ride';
import type { DriverRideRequest } from '../types/driverRideRequest';
import { setCurrentRide, clearCurrentRide, DriverCurrentRide } from '../store/driverCurrentRideSlice';
import { store } from '../store';

/**
 * Location coordinates
 */
type LocationCoordinates = {
  latitude: number;
  longitude: number;
};

/**
 * Ride location with address and coordinates
 */
type RideLocationDetail = {
  address: string;
  coordinates: LocationCoordinates;
  placeId: string;
};

/**
 * Driver information
 */
type DriverDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhotoUrl: string;
  ratings: {
    count: number;
    average: number;
  };
};

/**
 * Rider/Passenger information
 */
type RiderDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhotoUrl: string | null;
  ratings: {
    count: number;
    average: number;
  };
};

/**
 * Ride matching details
 */
type RideMatchingDetail = {
  dispatchStatus: string;
  failureReason: string | null;
  offerId: string;
  selectedDriverId: string;
  updatedAt: string;
};

/**
 * Schedule information
 */
type ScheduleDetail = {
  type: "now" | "scheduled";
};

/**
 * Driver's active ride being tracked
 */
export type DriverActiveRide = {
  id: string;
  status: RideStatus;
  passengerId: string;
  paymentMethod: string;
  price: string;
  rideType: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  cancelBy?: string | null;
  maxSkipLimit: number;
  skipCount: number;
  stopLocation?: RideLocationDetail | null;
  pickupLocation: RideLocationDetail;
  destinationLocation: RideLocationDetail;
  driver: DriverDetail;
  rider: RiderDetail;
  matching: RideMatchingDetail;
  schedule: ScheduleDetail;
  estimatedTimeRemaining?: string;
  estimatedDistance?: string;
};

/**
 * Listens to all active (non-terminal) rides where the driver is assigned
 * Terminal statuses: 'completed', 'cancelled'
 *
 * @param driverId - The ID of the driver
 * @param onRideUpdate - Callback when ride data changes
 * @param onError - Optional error callback
 * @returns Unsubscribe function
 */
export function listenToDriverActiveRide(
  driverId: string,
  onRideUpdate: (ride: DriverActiveRide | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  try {
    const ridesCollection = collection(db, 'rides');
    
    // Query rides where this driver is assigned
    const q = query(
      ridesCollection,
      where('driver.id', '==', driverId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Filter out terminal statuses and get first active ride
        const activeRide = snapshot.docs.find((doc) => {
          const data = doc.data();
          const status = (data.status as RideStatus) || 'requested';
          return !['completed', 'cancelled'].includes(status);
        });

        if (activeRide) {
          const data = activeRide.data();
          
          // Cast raw Firestore data to DriverCurrentRide (it has the same structure)
          const rideData = {
            id: activeRide.id,
            ...data,
          } as DriverCurrentRide;
          
          // Dispatch ride data to Redux
          store.dispatch(setCurrentRide(rideData));
          
          // Notify callback with same structured data for DriverActiveRide
          onRideUpdate(rideData as unknown as DriverActiveRide);
        } else {
          // No active ride found - clear current ride state
          store.dispatch(clearCurrentRide());
          onRideUpdate(null);
        }
      },
      (error) => {
        console.error('[driverRideListener] Firestore error:', error);
        onError?.(error);
      },
    );

    return unsubscribe;
  } catch (error) {
    console.error('[driverRideListener] Setup error:', error);
    if (error instanceof Error) {
      onError?.(error);
    }
    return () => {}; // Return dummy unsubscribe
  }
}

/**
 * Type for incoming ride offer/request
 */
export type DriverRideOffer = {
  id: string;
  rideId: string;
  driverId: string;
  status: string;
  createdAt?: string;
  respondedAt?: string;
};

/**
 * Listens to pending ride offers for a driver in real-time
 * This detects incoming ride requests from passengers
 * Fetches full ride details and builds a complete DriverRideRequest
 *
 * @param driverId - The ID of the driver
 * @param onOfferUpdate - Callback when a new offer arrives (status='pending')
 * @param onError - Optional error callback
 * @returns Unsubscribe function
 */
export function listenToDriverRideOffers(
  driverId: string,
  onOfferUpdate: (offer: DriverRideRequest | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  try {
    
    const offersCollection = collection(db, 'ride_offers');
    const ridesCollection = collection(db, 'rides');
    
    // Query ride_offers where driverId matches and status is 'pending'
    const q = query(
      offersCollection,
      where('driverId', '==', driverId),
      where('status', '==', 'pending'),
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {

        // Process first pending offer
        if (snapshot.docs.length > 0) {
          const offerDoc = snapshot.docs[0];
          const offerData = offerDoc.data();
          const rideId = offerData.rideId;

   

          // Fetch the full ride details
          try {
            const rideRef = doc(ridesCollection, rideId);
            const rideSnap = await getDoc(rideRef);

            if (rideSnap.exists) {
              const rideData = rideSnap.data();
             
              // Build complete DriverRideRequest with coordinates
              const driverRideRequest: DriverRideRequest = {
                offerId: offerDoc.id,
                rideId,
                passengerId: rideData?.passengerId || '',
                pickupAddress: rideData?.pickupLocation?.address || 'Unknown Location',
                pickupCoordinates: rideData?.pickupLocation?.coordinates
                  ? {
                      latitude: rideData.pickupLocation.coordinates.latitude,
                      longitude: rideData.pickupLocation.coordinates.longitude,
                    }
                  : undefined,
                destinationAddress: rideData?.destinationLocation?.address || 'Unknown Location',
                destinationCoordinates: rideData?.destinationLocation?.coordinates
                  ? {
                      latitude: rideData.destinationLocation.coordinates.latitude,
                      longitude: rideData.destinationLocation.coordinates.longitude,
                    }
                  : undefined,
                paymentMethod: rideData?.paymentMethod || 'cash',
                fare: rideData?.fare,
                currency: rideData?.currency || 'USD',
                estimatedDistance: rideData?.estimatedDistance,
                estimatedDuration: rideData?.estimatedDuration,
                requestedAt: offerData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                expiresAt: new Date(Date.now() + 30000).toISOString(), // 30 sec timeout
              };

            
              onOfferUpdate(driverRideRequest);
            } else {
              console.warn('[listenToDriverRideOffers] Ride document not found:', rideId);
              onOfferUpdate(null);
            }
          } catch (fetchError) {
            console.error('[listenToDriverRideOffers] Error fetching ride data:', fetchError);
            onOfferUpdate(null);
          }
        } else {
          console.log('[listenToDriverRideOffers] No pending offers found');
          onOfferUpdate(null);
        }
      },
      (error) => {
        console.error('[listenToDriverRideOffers] Firestore listener error:', error);
        console.error('[listenToDriverRideOffers] Error details:', {
          code: (error as any)?.code,
          message: error.message,
        });
        onError?.(error);
      },
    );

    return unsubscribe;
  } catch (error) {
    console.error('[listenToDriverRideOffers] Setup error:', error);
    if (error instanceof Error) {
      onError?.(error);
    }
    return () => {}; // Return dummy unsubscribe
  }
}
