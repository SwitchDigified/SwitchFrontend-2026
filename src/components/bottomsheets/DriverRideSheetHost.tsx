import React, { useCallback, useMemo, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setCurrentDriverRideRequest,
  dismissCurrentDriverRideRequest,
} from '../../store/driverRideRequestSlice';
import { listenToDriverRideOffers } from '../../listeners/driverRideListener';
import { RideRequestSheet } from './RideRequestSheet';
import { RideAcceptedSheet } from './RideAcceptedSheet';
import { RideOnTripSheet } from './RideOnTripSheet';
import type { DriverRideRequest } from '../../types/driverRideRequest';

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
        currentRide.status === 'accepted' && (
        <RideAcceptedSheet
          visible={true}
          ride={currentRide}
          // onStartTrip={handleStartTrip}
          // onCancel={handleCancelRide}
          isLoading={isLoading}
        />
      )}

      {/* On Trip Sheet - Driver en route with passenger (show once status update confirmed) */}
      {currentRide && currentRide.status === 'on_trip' && (
        <RideOnTripSheet
          visible={true}
                   ride={currentRide}

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
