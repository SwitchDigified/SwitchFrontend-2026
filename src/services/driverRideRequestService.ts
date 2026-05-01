import { clearDriverActiveRide } from '../api/firestoreApi';
import { ridesApi } from '../api/apiClient';
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
  if (false) console.log('[Service] respondToDriverRideRequest called', {
    driverId,
    offerId: request.offerId,
    rideId: request.rideId,
    status,
  });

  const now = new Date().toISOString();

  try {
    let result = true;

    if (status === 'accepted') {
      await ridesApi.acceptRide(request.rideId, request.offerId, driverId);
    } else if (status === 'skipped') {
      await ridesApi.skipRide(request.rideId, request.offerId, driverId);
    } else {
      await ridesApi.expireRideOffer(request.rideId, request.offerId, driverId);
    }

    if (false) console.log('[Service] respondToDriverRideRequest completed', {
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
  if (false) console.log('[Service] clearDriverPendingRideRequest called', {
    driverId,
    rideId: request.rideId,
    offerId: request.offerId,
  });

  try {
    const now = new Date().toISOString();
    await clearDriverActiveRide(driverId, now);

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
