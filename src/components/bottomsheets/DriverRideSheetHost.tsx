import React, { useCallback, useMemo, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setCurrentRide,
  updateRideStatus,
  updateRideEstimates,
  clearCurrentRide,
  setLoading,
  setError,
} from '../../store/driverCurrentRideSlice';
import {
  setCurrentDriverRideRequest,
  dismissCurrentDriverRideRequest,
} from '../../store/driverRideRequestSlice';
import { updateRideStatusInFirestore, respondToRideOfferAndDriverPresence, deleteRideOfferForRide, clearDriverActiveRide } from '../../api/firestoreApi';
import { listenToDriverActiveRide, listenToDriverRideOffers } from '../../listeners/driverRideListener';
import { RideRequestSheet } from './RideRequestSheet';
import { RideAcceptedSheet } from './RideAcceptedSheet';
import { RideOnTripSheet } from './RideOnTripSheet';
import type { DriverRideRequest } from '../../types/driverRideRequest';
import type { DriverCurrentRide } from '../../store/driverCurrentRideSlice';

/**
 * Main orchestrator for all driver ride-related bottom sheets
 * Renders the appropriate sheet based on current ride status
 *
 * Handles:
 * - Ride request incoming (requested status)
 * - Accept ride (accepted status)
 * - En route to pickup/destination (on_trip status)
 * - Arrived at pickup/destination (arrived status)
 * - Ride completed (completed status)
 */
export function DriverRideSheetHost() {
  const dispatch = useAppDispatch();
  const currentRide = useAppSelector((state) => state.driverCurrentRide.currentRide);
  const isLoading = useAppSelector((state) => state.driverCurrentRide.isLoading);
  const driverId = useAppSelector((state) => state.auth.session?.user.id);

  // Track when we're in a transitional state (waiting for Firestore update)
  const [isWaitingForStatusUpdate, setIsWaitingForStatusUpdate] = React.useState(false);
  const [targetStatus, setTargetStatus] = React.useState<string | null>(null);

  // ========== LISTENER 1: Active rides (already accepted/on-trip/arrived) ==========
  useEffect(() => {
    if (!driverId) {
      return;
    }


    const unsubscribe = listenToDriverActiveRide(
      driverId,
      (ride) => {
        if (ride) {
          // Update Redux with the ride data
          dispatch(
            setCurrentRide({
              id: ride.id,
              status: ride.status,
              passengerId: ride.passengerId,
              passengerName: ride.passengerName,
              passengerPhone: ride.passengerPhone,
              pickupAddress: ride.pickupAddress,
              pickupCoordinates: ride.pickupCoordinates,
              destinationAddress: ride.destinationAddress,
              destinationCoordinates: ride.destinationCoordinates,
              paymentMethod: ride.paymentMethod,
              estimatedPickupTime: ride.estimatedPickupTime,
              estimatedTimeRemaining: ride.estimatedTimeRemaining,
              estimatedDistance: ride.estimatedDistance,
              tripDuration: ride.tripDuration,
              tripDistance: ride.tripDistance,
              fare: ride.fare,
              currency: ride.currency,
              createdAt: ride.createdAt,
              updatedAt: ride.updatedAt,
            })
          );

          // If we were waiting for a status update and it arrived, mark it complete
          if (isWaitingForStatusUpdate && targetStatus === ride.status) {
            setIsWaitingForStatusUpdate(false);
            setTargetStatus(null);
          }
        } else {
          // No active ride
          dispatch(clearCurrentRide());
          setIsWaitingForStatusUpdate(false);
          setTargetStatus(null);
        }
      },
      (error) => {
        console.error('[DriverRideSheetHost] Active ride listener error:', error);
        setIsWaitingForStatusUpdate(false);
        setTargetStatus(null);
      },
    );

    return () => {
      console.log('[DriverRideSheetHost] Cleaning up active ride listener');
      unsubscribe();
    };
  }, [driverId, dispatch, isWaitingForStatusUpdate, targetStatus]);

  // ========== LISTENER 2: Incoming ride offers (pending requests) ==========
  useEffect(() => {
    if (!driverId) {
      return;
    }


    const unsubscribe = listenToDriverRideOffers(
      driverId,
      (offer) => {
        if (offer) {
          // Dispatch the full DriverRideRequest to Redux
          dispatch(setCurrentDriverRideRequest(offer));
        } else {
          // No pending offer
          dispatch(dismissCurrentDriverRideRequest());
        }
      },
      (error) => {
        console.error('[DriverRideSheetHost] Ride offer listener error:', error);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [driverId, dispatch]);

  // Don't render if no driver session
  if (!driverId) {
    return null;
  }



 


 


  // Sheet visibility based on ride status
  const currentRequest = useAppSelector((state) => state.driverRideRequest.currentRequest);

  const showRequestSheet = useMemo(() => {
 
    // Show request sheet when there's a pending offer AND no active ride
    return !!currentRequest && !currentRide;
  }, [currentRide, currentRequest]);

  const handleRideRequestExpired = React.useCallback(
    (request: DriverRideRequest) => {
      console.log('[DriverRideSheetHost] Ride request expired', {
        offerId: request.offerId,
        rideId: request.rideId,
      });
      dispatch(dismissCurrentDriverRideRequest());
    },
    [dispatch]
  );

  return (
    <>
      {/* Ride Request - Show when no current ride */}
      {showRequestSheet && (
        <RideRequestSheetHost
          onExpired={handleRideRequestExpired}
        />
      )}

      {/* Accepted Sheet - Driver heading to pickup (but not waiting for status update) */}
      {currentRide && 
        currentRide.status === 'accepted' && 
        !isWaitingForStatusUpdate && (
        <RideAcceptedSheet
          visible={true}
          ride={{
            id: currentRide.id,
            pickupAddress: currentRide.pickupAddress,
            destinationAddress: currentRide.destinationAddress,
            passengerName: currentRide.passengerName,
            passengerPhone: currentRide.passengerPhone || '',
            estimatedPickupTime: currentRide.estimatedPickupTime || '5 mins',
            paymentMethod: currentRide.paymentMethod || 'Cash',
            pickupCoordinates: currentRide.pickupCoordinates,
            destinationCoordinates: currentRide.destinationCoordinates,
          }}
          // onStartTrip={handleStartTrip}
          // onCancel={handleCancelRide}
          isLoading={isLoading}
        />
      )}

      {/* On Trip Sheet - Driver en route with passenger (show once status update confirmed) */}
      {currentRide && currentRide.status === 'on_trip' && (
        <RideOnTripSheet
          visible={true}
          ride={{
            id: currentRide.id,
            pickupAddress: currentRide.pickupAddress,
            destinationAddress: currentRide.destinationAddress,
            passengerName: currentRide.passengerName,
            passengerPhone: currentRide.passengerPhone || '',
            paymentMethod: currentRide.paymentMethod || 'Cash',
            fare: String(currentRide.fare || 0),
            pickupCoordinates: currentRide.pickupCoordinates,
            destinationCoordinates: currentRide.destinationCoordinates,
            timeRemaining: currentRide.estimatedTimeRemaining,
            distanceRemaining: currentRide.estimatedDistance,
          }}
          // onArrived={handleCompleteRide}
          // onEmergency={handleEmergency}
          // isLoading={isLoading}
        />
      )}
    </>
  );
}

/**
 * Sub-component: Handles ride request incoming
 * Wraps RideRequestSheet with expiration logic
 */
function RideRequestSheetHost({
  onExpired,
}: {
  onExpired: (request: DriverRideRequest) => void;
}) {
  const currentRequest = useAppSelector((state) => state.driverRideRequest.currentRequest);
  const dispatch = useAppDispatch();

  const handleExpired = useCallback(
    (request: DriverRideRequest) => {
      dispatch(dismissCurrentDriverRideRequest());
      onExpired(request);
    },
    [onExpired, dispatch]
  );

  return (
    <RideRequestSheet
      visible={Boolean(currentRequest)}
      request={currentRequest}
      onExpired={handleExpired}
    />
  );
}

export { RideRequestSheetHost };
