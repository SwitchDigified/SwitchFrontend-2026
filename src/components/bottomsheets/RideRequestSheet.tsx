import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { showError, showSuccess } from '../../store/toastSlice';
import { ridesApi } from '../../api/apiClient';
import { MapPin, Star, User } from 'lucide-react-native';
import { useCalculateDistance } from '../../hooks/useCalculateDistance';

import type { DriverRideRequest } from '../../types/driverRideRequest';
import { appColors } from '../../theme/colors';
import { AppButton } from '../ui/AppButton';
import { AppText } from '../ui/AppText';
import { BottomSheet2 } from '../../features/passenger/passengerHome/components/planner_sheets/BottomSheet2';

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
  onExpired,
}: RideRequestSheetProps) {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const driverId = useAppSelector(state => state.auth.session?.user.id);
  const driverLocation = useAppSelector(
    state => state.driverLocation.currentLocation,
  );
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const requestId = request?.offerId ?? null;
  const isActive = visible && Boolean(request);

  useEffect(() => {
    if (!request) {
      setRemainingSeconds(0);
      return;
    }

    const initialSeconds = Math.max(
      0,
      Math.ceil((new Date(request.expiresAt).getTime() - Date.now()) / 1000),
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
        Math.ceil((new Date(request.expiresAt).getTime() - Date.now()) / 1000),
      );
      setRemainingSeconds(nextSeconds);

      if (nextSeconds <= 0) {
        clearInterval(timer);
        onExpired(request);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [onExpired, request, requestId, visible]);

  const handleAccept = async () => {
    if (!request || !driverId) {
      dispatch(
        showError({
          message: 'Driver not authenticated. Please log in again.',
        }),
      );
      return;
    }

    try {
      setIsLoading(true);
      const data = await ridesApi.acceptRide(
        request.rideId,
        request.offerId,
        driverId,
      );
      dispatch(showSuccess({ message: 'Ride accepted successfully' }));
    } catch (error) {
      const errorMessage = (error as any)?.message ?? 'Failed to accept ride';
      console.error('[RideRequestSheet] Error accepting ride:', errorMessage);
      dispatch(showError({ message: errorMessage, duration: 5000 }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!request || !driverId) {
      dispatch(
        showError({
          message: 'Driver not authenticated. Please log in again.',
        }),
      );
      return;
    }

    try {
      setIsLoading(true);
      const data = await ridesApi.skipRide(
        request.rideId,
        request.offerId,
        driverId,
      );
    } catch (error) {
      const errorMessage = (error as any)?.message ?? 'Failed to skip ride';
      console.error('[RideRequestSheet] Error skipping ride:', errorMessage);
      dispatch(showError({ message: errorMessage, duration: 5000 }));
    } finally {
      setIsLoading(false);
    }
  };

  const countdownLabel = useMemo(
    () => formatSeconds(remainingSeconds),
    [remainingSeconds],
  );

  const countdownColor =
    remainingSeconds <= 5
      ? appColors.danger
      : remainingSeconds <= 8
      ? '#F59E0B'
      : appColors.accent;

  const handleClose = () => {
    if (request) {
      onExpired(request);
    }
  };

  // Calculate distance and time from pickup to destination
  const { distanceString, timeRemaining } = useCalculateDistance(
    request?.pickupCoordinates,
    request?.destinationCoordinates
  );

  return (
    <BottomSheet2
      visible={isActive}
      onClose={handleClose}
      height={420}
      snapPoints={[0, 550]}
      allowSheetDrag={false}
      showButton
      buttonOnSwipe={handleAccept}
      buttonType='swipe action button'
      buttonLabel='ACCEPT RIDE'
    >
      <View style={styles.container}>
        {/* Countdown Timer */}
        <View style={styles.countdownRow}>
          <AppText variant="xs" style={styles.countdownCaption}>
            Offer expires in
          </AppText>
          <View style={[styles.countdownBadge, { borderColor: countdownColor }]}>
            <AppText style={[styles.countdownNumber, { color: countdownColor }]}>
              {remainingSeconds}
            </AppText>
          </View>
          <AppText variant="xs" style={styles.countdownCaption}>
            seconds
          </AppText>
        </View>

        {/* Passenger Info Section */}
        <View style={styles.passengerSection}>
          <View style={styles.passengerLeft}>
            <View style={styles.avatarContainer}>
              <User size={32} color={appColors.accent} />
            </View>
            <View style={styles.passengerDetails}>
              <AppText variant="label" style={styles.passengerName}>
passenger              </AppText>
              <AppText variant="xs" style={styles.passengerHandle}>
                ID: {request?.passengerId ?? 'Unknown'}
              </AppText>
            </View>
          </View>
          <View style={styles.ratingBadge}>
            <View style={styles.ratingContent}>
              <Star size={14} color="#FFD700" fill="#FFD700" />
              <AppText variant="caption" style={styles.ratingText}>
                4.9
              </AppText>
            </View>
          </View>
        </View>

        {/* Pickup Location */}
        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIcon}>
              <MapPin size={18} color={appColors.accent} />
            </View>
            <AppText variant="xs" style={styles.locationLabel}>
              Pickup location
            </AppText>
          </View>
          <AppText variant="body" style={styles.locationAddress}>
            {request?.pickupAddress ?? 'Pickup location'}
          </AppText>
        </View>

        {/* Destination Location */}
        <View style={styles.locationSection}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIcon}>
              <MapPin size={18} color={appColors.danger} />
            </View>
            <AppText variant="xs" style={styles.locationLabel}>
              Destination
            </AppText>
          </View>
          <AppText variant="body" style={styles.locationAddress}>
            {request?.destinationAddress ?? 'Destination location'}
          </AppText>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <AppText variant="xs" style={styles.statLabel}>
              Distance
            </AppText>
            <AppText variant="label" style={styles.statValue}>
              {distanceString}
            </AppText>
            <AppText variant="xs" style={styles.statNote}>
              ({timeRemaining})
            </AppText>
          </View>
          <View style={styles.statCard}>
            <AppText variant="xs" style={styles.statLabel}>
              Passenger
            </AppText>
            <AppText variant="label" style={styles.statValue}>
              1 person
            </AppText>
          </View>
          <View style={styles.statCard}>
            <AppText variant="xs" style={styles.statLabel}>
              Ride Fare
            </AppText>
            <AppText variant="label" style={styles.statValue}>
              {request?.fare ? `${request.currency || 'NGN'}${request.fare.toLocaleString()}` : 'NGN0'}
            </AppText>
          </View>
        </View>

      </View>
    </BottomSheet2>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    backgroundColor: appColors.primary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  passengerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  passengerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(28, 110, 242, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    color: appColors.textLight,
    fontSize: 16,
    fontWeight: '700',
  },
  passengerHandle: {
    color: appColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  ratingBadge: {
    backgroundColor: appColors.textLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ratingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: appColors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  locationSection: {
    gap: 6,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLabel: {
    color: appColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  locationAddress: {
    color: appColors.textLight,
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    color: appColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  statValue: {
    color: appColors.textLight,
    fontSize: 14,
    fontWeight: '700',
  },
  statNote: {
    color: appColors.textMuted,
    fontSize: 10,
  },
  timerContainer: {
    alignSelf: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timerLabel: {
    color: appColors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  actions: {
    marginTop: 12,
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    height: 56,
  },
  skipButton: {
    height: 48,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  countdownCaption: {
    color: appColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  countdownBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  countdownNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
});
