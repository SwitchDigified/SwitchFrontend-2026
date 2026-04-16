import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

import {
  clearDriverPendingRideRequest,
  respondToDriverRideRequest
} from '../../services/driverRideRequestService';
import {
  dismissCurrentDriverRideRequest,
  setCurrentDriverRideRequest
} from '../../store/driverRideRequestSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import type { DriverRideRequest } from '../../types/driverRideRequest';
import { RideRequestSheet } from './RideRequestSheet';

const DEFAULT_RIDE_REQUEST_TIMEOUT_SECONDS = 20;

const getString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
};

const toIsoOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const parseDriverRideRequestFromMessage = (
  message: FirebaseMessagingTypes.RemoteMessage
): DriverRideRequest | null => {
  const data = message.data ?? {};
  const type = getString(data.type);
  if (type !== 'ride_request') {
    return null;
  }

  const offerId = getString(data.offerId);
  const rideId = getString(data.rideId);
  if (!offerId || !rideId) {
    return null;
  }

  const requestedAt = toIsoOrNull(data.requestedAt) ?? new Date().toISOString();
  const expiresAt =
    toIsoOrNull(data.expiresAt) ??
    new Date(Date.now() + DEFAULT_RIDE_REQUEST_TIMEOUT_SECONDS * 1000).toISOString();

  return {
    offerId,
    rideId,
    passengerId: getString(data.passengerId, 'unknown-passenger'),
    pickupAddress: getString(data.pickupAddress, 'Pickup location'),
    destinationAddress: getString(data.destinationAddress, 'Destination location'),
    paymentMethod: getString(data.paymentMethod, 'cash'),
    requestedAt,
    expiresAt
  };
};

export function DriverRideRequestSheetHost() {
  const dispatch = useAppDispatch();
  const currentRequest = useAppSelector((state) => state.driverRideRequest.currentRequest);
  const session = useAppSelector((state) => state.auth.session);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const driverId = useMemo(() => {
    if (!session || session.user.role !== 'driver') {
      return null;
    }
    return session.user.id;
  }, [session]);

  const pushIncomingRequest = useCallback(
    (request: DriverRideRequest) => {
      dispatch(setCurrentDriverRideRequest(request));
    },
    [dispatch]
  );

  useEffect(() => {
    if (!driverId) {
      dispatch(dismissCurrentDriverRideRequest(undefined));
      return;
    }

    const handleRemoteMessage = (message: FirebaseMessagingTypes.RemoteMessage) => {
      const nextRequest = parseDriverRideRequestFromMessage(message);
      if (!nextRequest) {
        return;
      }

      pushIncomingRequest(nextRequest);
    };

    const unsubscribeForeground = messaging().onMessage(handleRemoteMessage);
    const unsubscribeOpened = messaging().onNotificationOpenedApp(handleRemoteMessage);

    void messaging().getInitialNotification().then((message) => {
      if (!message) {
        return;
      }
      handleRemoteMessage(message);
    });

    return () => {
      unsubscribeForeground();
      unsubscribeOpened();
    };
  }, [dispatch, driverId, pushIncomingRequest]);

  const dismissRequest = useCallback(
    (offerId?: string) => {
      dispatch(dismissCurrentDriverRideRequest({ offerId }));
    },
    [dispatch]
  );

  const submitResponse = useCallback(
    async (request: DriverRideRequest, status: 'accepted' | 'skipped' | 'expired') => {
      console.log('[Component] submitResponse called', {
        driverId,
        offerId: request.offerId,
        rideId: request.rideId,
        status,
        isSubmitting,
      });

      if (!driverId || isSubmitting) {
        console.warn('[Component] Early return - missing driverId or already submitting', {
          hasDriverId: !!driverId,
          isSubmitting,
        });
        return;
      }

      setIsSubmitting(status === 'accepted');

      try {
        console.log('[Component] Calling respondToDriverRideRequest...', {
          driverId,
          offerId: request.offerId,
          rideId: request.rideId,
          status,
        });

        const hasUpdatedOffer = await respondToDriverRideRequest({
          driverId,
          request,
          status
        });

        console.log('[Component] respondToDriverRideRequest returned', {
          hasUpdatedOffer,
          status,
        });

        if (!hasUpdatedOffer) {
          console.warn('[Component] Offer was not updated, clearing driver pending request');
          await clearDriverPendingRideRequest(driverId, request);
        }

        if (status === 'accepted') {
          console.log('[Component] Ride accepted successfully');
          Alert.alert('Ride accepted', 'We are connecting you to the passenger now.');
        } else {
          console.log('[Component] Ride response submitted', { status });
        }
      } catch (error) {
        console.error('[Component] submitResponse FAILED with error', {
          status,
          driverId,
          offerId: request.offerId,
          rideId: request.rideId,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCode: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN',
          errorStack: error instanceof Error ? error.stack : 'No stack',
          fullError: error,
        });

        if (status === 'accepted') {
          const errorMessage = error instanceof Error ? error.message : 'Try again in a moment.';
          Alert.alert(
            'Unable to accept ride',
            errorMessage
          );
        }
      } finally {
        setIsSubmitting(false);
        dismissRequest(request.offerId);
      }
    },
    [dismissRequest, driverId, isSubmitting]
  );

  if (!driverId) {
    return null;
  }

  return (
    <RideRequestSheet
      visible={Boolean(currentRequest)}
      request={currentRequest}
      isSubmitting={isSubmitting}
      onAccept={(request) => {
        void submitResponse(request, 'accepted');
      }}
      onSkip={(request) => {
        void submitResponse(request, 'skipped');
      }}
      onExpired={(request) => {
        void submitResponse(request, 'expired');
      }}
    />
  );
}
