import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, Unsubscribe, getDoc, doc } from '@react-native-firebase/firestore';
import type { RideStatus } from '../types/ride';
import type { DriverRideRequest } from '../types/driverRideRequest';

/**
 * Location coordinates
 */
type LocationCoordinates = {
  latitude: number;
  longitude: number;
};

/**
 * Driver's active ride being tracked
 */
export type DriverActiveRide = {
  id: string;
  status: RideStatus;
  passengerId: string;
  passengerName: string;
  passengerPhone?: string;
  pickupAddress: string;
  pickupCoordinates?: LocationCoordinates;
  destinationAddress: string;
  destinationCoordinates?: LocationCoordinates;
  paymentMethod?: string;
  estimatedPickupTime?: string;
  estimatedTimeRemaining?: string;
  estimatedDistance?: string;
  tripDuration?: string;
  tripDistance?: string;
  fare?: number;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
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
    
    // Query rides where this driver is assigned and status is not terminal
    const q = query(
      ridesCollection,
      where('driver.id', '==', driverId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rides = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              status: (data.status as RideStatus) || 'requested',
              passengerId: data.passengerId || '',
              passengerName: data.rider?.firstName
                ? `${data.rider.firstName} ${data.rider.lastName || ''.trim()}`
                : 'Passenger',
              passengerPhone: data.rider?.phone,
              pickupAddress: data.pickupLocation?.address || '',
              pickupCoordinates: data.pickupLocation?.coordinates
                ? {
                    latitude: data.pickupLocation.coordinates.latitude,
                    longitude: data.pickupLocation.coordinates.longitude,
                  }
                : undefined,
              destinationAddress: data.destinationLocation?.address || '',
              destinationCoordinates: data.destinationLocation?.coordinates
                ? {
                    latitude: data.destinationLocation.coordinates.latitude,
                    longitude: data.destinationLocation.coordinates.longitude,
                  }
                : undefined,
              paymentMethod: data.paymentMethod || undefined,
              estimatedPickupTime: data.estimatedPickupTime,
              estimatedTimeRemaining: data.estimatedTimeRemaining,
              estimatedDistance: data.estimatedDistance,
              tripDuration: data.tripDuration,
              tripDistance: data.tripDistance,
              fare: data.fare,
              currency: data.currency,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            } as DriverActiveRide;
          })
          // Filter out terminal statuses
          .filter((ride) => !['completed', 'cancelled'].includes(ride.status));

        // Return the first active ride, or null if none
        onRideUpdate(rides.length > 0 ? rides[0] : null);
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
    console.log('[listenToDriverRideOffers] Setting up listener for driver:', driverId);
    
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
        console.log('[listenToDriverRideOffers] Snapshot received:', {
          count: snapshot.docs.length,
          hasChanges: snapshot.docChanges().length > 0,
        });

        // Process first pending offer
        if (snapshot.docs.length > 0) {
          const offerDoc = snapshot.docs[0];
          const offerData = offerDoc.data();
          const rideId = offerData.rideId;

          console.log('[listenToDriverRideOffers] Processing offer:', {
            offerId: offerDoc.id,
            rideId,
            status: offerData.status,
          });

          // Fetch the full ride details
          try {
            const rideRef = doc(ridesCollection, rideId);
            const rideSnap = await getDoc(rideRef);

            if (rideSnap.exists) {
              const rideData = rideSnap.data();
              console.log('[listenToDriverRideOffers] Ride data fetched:', {
                rideId,
                status: rideData?.status,
                pickupAddress: rideData?.pickupLocation?.address,
              });

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

              console.log('[listenToDriverRideOffers] Calling onOfferUpdate with request:', {
                offerId: driverRideRequest.offerId,
                rideId: driverRideRequest.rideId,
              });
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

    console.log('[listenToDriverRideOffers] Listener attached successfully');
    return unsubscribe;
  } catch (error) {
    console.error('[listenToDriverRideOffers] Setup error:', error);
    if (error instanceof Error) {
      onError?.(error);
    }
    return () => {}; // Return dummy unsubscribe
  }
}
