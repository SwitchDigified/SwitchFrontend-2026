import {
  clearDriverActiveRide,
  respondToRideOfferAndDriverPresence
} from '../api/firestoreApi';
import type { DriverRideRequest, DriverRideRequestStatus } from '../types/driverRideRequest';

export const DRIVER_OFFER_STATUS = {
  accepted: 'accepted',
  skipped: 'skipped',
  expired: 'expired'
} as const;

type RespondToDriverRideRequestInput = {
  driverId: string;
  request: DriverRideRequest;
  status: DriverRideRequestStatus;
};

export const respondToDriverRideRequest = async ({
  driverId,
  request,
  status
}: RespondToDriverRideRequestInput): Promise<boolean> => {
  console.log('[Service] respondToDriverRideRequest called', {
    driverId,
    offerId: request.offerId,
    rideId: request.rideId,
    status,
  });

  const now = new Date().toISOString();

  try {
    const result = await respondToRideOfferAndDriverPresence({
      driverId,
      offerId: request.offerId,
      rideId: request.rideId,
      status,
      updatedAt: now
    });

    console.log('[Service] respondToDriverRideRequest completed', {
      success: result,
      driverId,
      rideId: request.rideId,
      status,
    });

    return result;
  } catch (error) {
    console.error('[Service] respondToDriverRideRequest failed', {
      errorMessage: error instanceof Error ? error.message : String(error),
      driverId,
      rideId: request.rideId,
      status,
      error,
    });
    throw error;
  }
};

export const clearDriverPendingRideRequest = async (
  driverId: string,
  request: DriverRideRequest
): Promise<void> => {
  console.log('[Service] clearDriverPendingRideRequest called', {
    driverId,
    rideId: request.rideId,
    offerId: request.offerId,
  });

  try {
    const now = new Date().toISOString();
    await clearDriverActiveRide(driverId, now);
    console.log('[Service] clearDriverPendingRideRequest completed successfully', { driverId });
  } catch (error) {
    console.error('[Service] clearDriverPendingRideRequest failed', {
      driverId,
      rideId: request.rideId,
      errorMessage: error instanceof Error ? error.message : String(error),
      error,
    });
    throw error;
  }
};
