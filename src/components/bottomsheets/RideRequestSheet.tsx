import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { showError, showSuccess } from '../../store/toastSlice';
import { ridesApi } from '../../api/apiClient';
import { UberMap } from '../../features/driver/map/UberMap';

import type { DriverRideRequest } from '../../types/driverRideRequest';
import { appColors } from '../../theme/colors';
import { AppButton } from '../ui/AppButton';
import { AppText } from '../ui/AppText';
import { BaseBottomSheet } from './BaseBottomSheet';

type RideRequestSheetProps = {
  visible: boolean;
  request: DriverRideRequest | null;
  isSubmitting?: boolean;
  onExpired: (request: DriverRideRequest) => void;
};

const formatSeconds = (seconds: number) => {
  const safeSeconds = Math.max(seconds, 0);
  const mins = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (safeSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export function RideRequestSheet({
  visible,
  request,
  isSubmitting = false,
  onExpired
}: RideRequestSheetProps) {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const driverId = useAppSelector((state) => state.auth.session?.user.id);
  const driverLocation = useAppSelector((state) => state.driverLocation.currentLocation);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  console.log('[RideRequestSheet] Rendered with request:', request, 'visible:', visible, 'driverId:', driverId);

  const requestId = request?.offerId ?? null;
  const isActive = visible && Boolean(request);

  useEffect(() => {
    if (!request) {
      setRemainingSeconds(0);
      return;
    }

    const initialSeconds = Math.max(
      0,
      Math.ceil((new Date(request.expiresAt).getTime() - Date.now()) / 1000)
    );
    setRemainingSeconds(initialSeconds);
  }, [request]);

  useEffect(() => {
    if (!request || !visible) {
      return;
    }

    const timer = setInterval(() => {
      const nextSeconds = Math.max(
        0,
        Math.ceil((new Date(request.expiresAt).getTime() - Date.now()) / 1000)
      );
      setRemainingSeconds(nextSeconds);

      if (nextSeconds <= 0) {
        clearInterval(timer);
        // onExpired(request);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [onExpired, request, requestId, visible]);

  const handleAccept = async () => {
    if (!request || !driverId) {
      dispatch(showError({message: 'Driver not authenticated. Please log in again.'}));
      return;
    }

    try {
      setIsLoading(true);
      console.log('[RideRequestSheet] Accepting ride offer:', {
        rideId: request.rideId,
        offerId: request.offerId,
        driverId,
      });

      const data = await ridesApi.acceptRide(request.rideId, request.offerId, driverId);
      console.log('[RideRequestSheet] Ride accepted successfully:', data);
      dispatch(showSuccess({message: 'Ride accepted successfully'}));
    } catch (error) {
      const errorMessage = (error as any)?.message ?? 'Failed to accept ride';
      console.error('[RideRequestSheet] Error accepting ride:', errorMessage);
      dispatch(showError({message: errorMessage, duration: 5000}));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!request || !driverId) {
      dispatch(showError({message: 'Driver not authenticated. Please log in again.'}));
      return;
    }

    try {
      setIsLoading(true);
      console.log('[RideRequestSheet] Skipping ride offer:', {
        rideId: request.rideId,
        offerId: request.offerId,
        driverId,
      });

      const data = await ridesApi.skipRide(request.rideId, request.offerId, driverId);
      console.log('[RideRequestSheet] Ride skipped successfully:', data);
    } catch (error) {
      const errorMessage = (error as any)?.message ?? 'Failed to skip ride';
      console.error('[RideRequestSheet] Error skipping ride:', errorMessage);
      dispatch(showError({message: errorMessage, duration: 5000}));
    } finally {
      setIsLoading(false);
    }
  };

  const countdownLabel = useMemo(() => formatSeconds(remainingSeconds), [remainingSeconds]);

  // Check if we have all coordinates needed to display the map
  const hasMapData = 
    request && 
    driverLocation && 
    request.pickupCoordinates && 
    request.destinationCoordinates;

  return (
    <BaseBottomSheet visible={isActive}>
      <View style={[styles.container, { paddingBottom: Math.max(16, insets.bottom + 4) }]}>
        <View style={styles.dragHandle} />
        <View style={styles.headerRow}>
          <AppText variant="label" style={styles.title}>
            New Ride Request
          </AppText>
          <View style={styles.countdownPill}>
            <AppText variant="caption" style={styles.countdownText}>
              {countdownLabel}
            </AppText>
          </View>
        </View>

        {/* Map Display - Shows route if all coordinates available */}
        {hasMapData && request.pickupCoordinates && request.destinationCoordinates && (
          <View style={styles.mapContainer}>
            <UberMap
              driverLocation={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
              }}
              pickupLocation={request.pickupCoordinates}
              destination={request.destinationCoordinates}
              rideStatus="incoming_request"
            />
          </View>
        )}

        <View style={styles.infoCard}>
          <AppText variant="caption" style={styles.label}>
            Pickup
          </AppText>
          <AppText variant="body" style={styles.value}>
            {request?.pickupAddress ?? '-'}
          </AppText>
        </View>

        <View style={styles.infoCard}>
          <AppText variant="caption" style={styles.label}>
            Destination
          </AppText>
          <AppText variant="body" style={styles.value}>
            {request?.destinationAddress ?? '-'}
          </AppText>
        </View>

        <View style={styles.infoCard}>
          <AppText variant="caption" style={styles.label}>
            Payment
          </AppText>
          <AppText variant="body" style={styles.value}>
            {(request?.paymentMethod ?? 'cash').toUpperCase()}
          </AppText>
        </View>

        <View style={styles.actions}>
          <AppButton
            title="Skip"
            variant="white"
            disabled={!request || isLoading || isSubmitting}
            loading={false}
            onPress={handleSkip}
            containerStyle={styles.secondaryButton}
          />
          <AppButton
            title="Accept"
            variant="green"
            disabled={!request || isLoading || isSubmitting}
            loading={isLoading || isSubmitting}
            onPress={handleAccept}
            containerStyle={styles.primaryButton}
          />
        </View>
      </View>
    </BaseBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    backgroundColor: appColors.primary
  },
  dragHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(156, 163, 175, 0.6)',
    marginBottom: 4
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    color: appColors.textLight,
    fontSize: 18,
    fontWeight: '800'
  },
  countdownPill: {
    minWidth: 64,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.55)',
    backgroundColor: 'rgba(6, 78, 59, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  countdownText: {
    color: '#d1fae5',
    fontWeight: '700'
  },
  mapContainer: {
    height: 280,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2
  },
  label: {
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2
  },
  value: {
    color: appColors.textLight,
    fontSize: 14,
    lineHeight: 20
  },
  actions: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  secondaryButton: {
    flex: 1
  },
  primaryButton: {
    flex: 1
  }
});
