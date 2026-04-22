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

const DEFAULT_RIDE_REQUEST_TIMEOUT_SECONDS = 1800; // 30 minutes for testing

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
  console.log('[RideRequestSheetHost] Incoming FCM message received', {
    messageType: message.messageType,
    hasData: !!message.data,
    dataKeys: Object.keys(message.data ?? {}),
  });

  const data = message.data ?? {};
  const type = getString(data.type);
  
  console.log('[RideRequestSheetHost] Message type extracted', { type });

  if (type !== 'ride_request') {
    console.log('[RideRequestSheetHost] Message ignored - not a ride_request', { type });
    return null;
  }

  const offerId = getString(data.offerId);
  const rideId = getString(data.rideId);
  
  console.log('[RideRequestSheetHost] IDs extracted', { offerId, rideId });

  if (!offerId || !rideId) {
    console.warn('[RideRequestSheetHost] Invalid message - missing offerId or rideId', {
      hasOfferId: !!offerId,
      hasRideId: !!rideId,
    });
    return null;
  }

  const requestedAt = toIsoOrNull(data.requestedAt) ?? new Date().toISOString();
  const expiresAt =
    toIsoOrNull(data.expiresAt) ??
    new Date(Date.now() + DEFAULT_RIDE_REQUEST_TIMEOUT_SECONDS * 1000).toISOString();

  const request: DriverRideRequest = {
    offerId,
    rideId,
    passengerId: getString(data.passengerId, 'unknown-passenger'),
    pickupAddress: getString(data.pickupAddress, 'Pickup location'),
    destinationAddress: getString(data.destinationAddress, 'Destination location'),
    paymentMethod: getString(data.paymentMethod, 'cash'),
    requestedAt,
    expiresAt
  };

  console.log('[RideRequestSheetHost] DriverRideRequest parsed successfully', request);

  return request;
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
      console.log('[RideRequestSheetHost] pushIncomingRequest called - dispatching setCurrentDriverRideRequest', {
        offerId: request.offerId,
        rideId: request.rideId,
        pickupAddress: request.pickupAddress,
        destinationAddress: request.destinationAddress,
      });
      dispatch(setCurrentDriverRideRequest(request));
    },
    [dispatch]
  );

  useEffect(() => {
    console.log('[RideRequestSheetHost] useEffect - Setting up FCM listeners', {
      driverId,
      isDriverSession: session?.user.role === 'driver',
    });

    if (!driverId) {
      console.log('[RideRequestSheetHost] No driverId - dismissing current request and returning');
      dispatch(dismissCurrentDriverRideRequest(undefined));
      return;
    }

    const handleRemoteMessage = (message: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('[RideRequestSheetHost] handleRemoteMessage called', {
        driverId,
        messageId: message.messageId,
        sentTime: message.sentTime,
      });

      const nextRequest = parseDriverRideRequestFromMessage(message);
      
      if (!nextRequest) {
        console.log('[RideRequestSheetHost] Failed to parse ride request from message');
        return;
      }

      console.log('[RideRequestSheetHost] Parsed ride request - dispatching to Redux', {
        driverId,
        offerId: nextRequest.offerId,
        rideId: nextRequest.rideId,
      });

      pushIncomingRequest(nextRequest);
    };

    console.log('[RideRequestSheetHost] Registering FCM listeners...');
    const unsubscribeForeground = messaging().onMessage((message) => {
      console.log('[RideRequestSheetHost] FCM onMessage triggered (app in foreground)');
      handleRemoteMessage(message);
    });

    const unsubscribeOpened = messaging().onNotificationOpenedApp((message) => {
      console.log('[RideRequestSheetHost] FCM onNotificationOpenedApp triggered (app opened from notification)');
      handleRemoteMessage(message);
    });

    void messaging().getInitialNotification().then((message) => {
      if (!message) {
        console.log('[RideRequestSheetHost] getInitialNotification - no message (app was not started by notification)');
        return;
      }
      console.log('[RideRequestSheetHost] getInitialNotification returned a message (app was killed)');
      handleRemoteMessage(message);
    });

    console.log('[RideRequestSheetHost] FCM listeners registered successfully');

    return () => {
      console.log('[RideRequestSheetHost] Cleaning up FCM listeners');
      unsubscribeForeground();
      unsubscribeOpened();
    };
  }, [dispatch, driverId, pushIncomingRequest, session]);

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
    console.log('[RideRequestSheetHost] No driverId - returning null');
    return null;
  }

  const isSheetVisible = Boolean(currentRequest);
  if (isSheetVisible) {
    console.log('[RideRequestSheetHost] RideRequestSheet should be VISIBLE', {
      driverId,
      offerId: currentRequest?.offerId,
      rideId: currentRequest?.rideId,
      pickupAddress: currentRequest?.pickupAddress,
    });
  } else {
    console.log('[RideRequestSheetHost] RideRequestSheet is HIDDEN (no currentRequest)', { driverId });
  }

  return (
    <RideRequestSheet
      visible={isSheetVisible}
      request={currentRequest}
      isSubmitting={isSubmitting}
      onAccept={(request) => {
        console.log('[RideRequestSheetHost] onAccept triggered', { offerId: request.offerId });
        void submitResponse(request, 'accepted');
      }}
      onSkip={(request) => {
        console.log('[RideRequestSheetHost] onSkip triggered', { offerId: request.offerId });
        void submitResponse(request, 'skipped');
      }}
      onExpired={(request) => {
        console.log('[RideRequestSheetHost] onExpired triggered', { offerId: request.offerId });
        void submitResponse(request, 'expired');
      }}
    />
  );
}
