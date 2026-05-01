import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import {
  MapPin,
  Phone,
  MessageCircle,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../ui/AppText';
import { appColors } from '../../theme/colors';
import { BottomSheet2 } from '../../features/passenger/passengerHome/components/planner_sheets';
import { useCalculateDistance } from '../../hooks/useCalculateDistance';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { ridesApi } from '../../api/apiClient';
import { showError, showSuccess } from '../../store/toastSlice';
import { DriverActiveRide } from '../../listeners';

type RideOnTripSheetProps = {
  visible: boolean;
  ride: DriverActiveRide | null;
  onArrived?: () => void;
  onEmergency?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
};

export const RideOnTripSheet = ({
  visible,
  ride,
  onArrived,
  onEmergency,
  onCancel,
  isLoading = false,
}: RideOnTripSheetProps) => {
  const insets = useSafeAreaInsets();
  
  const dispatch = useAppDispatch();
  const currentRide = useAppSelector((state) => state.driverCurrentRide.currentRide);
  const currentDriverLocation = useAppSelector((state) => state.driverLocation.currentLocation);
   const driverId = useAppSelector((state) => state.auth.session?.user.id);

  // Local state for handling trip completion
  const [isStarting, setIsStarting] = useState(false);

  const pickupCoordinates =
    ride?.pickupLocation?.coordinates ?? currentRide?.pickupLocation?.coordinates;
  const destinationCoordinates =
    ride?.destinationLocation?.coordinates ?? currentRide?.destinationLocation?.coordinates;
  const pickupAddress = ride?.pickupLocation?.address ?? 'Pickup location unavailable';
  const destinationAddress =
    ride?.destinationLocation?.address ?? 'Destination unavailable';
  const riderPhone = ride?.rider?.phone;

  // Use the distance calculation hook for pickup to destination
  const { distanceString, timeRemaining } = useCalculateDistance(
    pickupCoordinates,
    destinationCoordinates
  );

  // Calculate distance from current driver location to destination (updates in real-time)
  const { distanceString: driverToDestinationDistance, timeRemaining: driverToDestinationTime } = useCalculateDistance(
    currentDriverLocation,
    destinationCoordinates
  );

  /**
   * Handle arrival at destination - Call API to complete the ride
   * Follows the same pattern as handleStartTrip
   */
  const handleArrivedAtDestination = async () => {
    if (!driverId) {
      dispatch(showError({message: 'Driver not authenticated. Please log in again.'}));
      return;
    }

    if (!ride) {
      dispatch(showError({message: 'Ride not found'}));
      return;
    }

    try {
      setIsStarting(true);
      const data = await ridesApi.completeTrip(ride.id, driverId);
      console.log('[RideOnTripSheet] Trip completed:', data);
      dispatch(showSuccess({message: 'Trip completed successfully'}));
      await onArrived?.();
    } catch (error) {
      const errorMessage = (error as any)?.response?.data?.message ?? (error as any)?.message ?? 'Failed to complete trip';
      console.error('[RideOnTripSheet] Error completing trip:', errorMessage);
      dispatch(showError({message: errorMessage, duration: 5000}));
    } finally {
      setIsStarting(false);
    }
  };

  if (!ride) return null;

  const handleCall = () => {
    if (riderPhone) Linking.openURL(`tel:${riderPhone}`);
  };

  const handleMessage = () => {
    if (riderPhone) Linking.openURL(`sms:${riderPhone}`);
  };

  const isButtonDisabled = isStarting || isLoading;
  const isShowingLoadingOverlay = isStarting || isLoading;

  return (
    <BottomSheet2
      visible={visible}
      onClose={() => {}}
      snapPoints={[0, 200]}
      allowSheetDrag={!isButtonDisabled}
      showButton={true}
      buttonType="swipe action button"
      isLoading={isShowingLoadingOverlay}
      buttonLabel={isShowingLoadingOverlay ? 'Updating...' : 'Arrived at destination'}
      onPressAction={handleArrivedAtDestination}
      height={360}

    >
      <View
        style={[
          styles.container,
          { paddingBottom: Math.max(16, insets.bottom + 4) },
        ]}
      >
        {/* Ride Info Header */}
        <View style={styles.rideInfoHeader}>
          <AppText variant="label" style={styles.rideInfoTitle}>
            Ride Info
          </AppText>
          <AppText variant="caption" style={styles.rideInfoDistance}>
            {distanceString} ({timeRemaining})
          </AppText>
        </View>

        {/* Driver to Destination Distance - Real-time Update */}
        {/* <View style={styles.driverDistanceInfo}>
          <AppText variant="caption" style={styles.driverDistanceLabel}>
            Distance to Destination
          </AppText>
          <AppText variant="label" style={styles.driverDistanceValue}>
            {driverToDestinationDistance} • {driverToDestinationTime}
          </AppText>
        </View> */}

        {/* Main Trip Card - Pickup & Fare Row */}
        <View style={styles.tripCard}>
          {/* Left Side: Pickup Location */}
          <View style={styles.locationSection}>
            <View
              style={[
                styles.locationDot,
                { backgroundColor: appColors.accent },
              ]}
            >
              <MapPin size={16} color="#111" strokeWidth={2.5} />
            </View>
            <View style={styles.locationContent}>
              <AppText variant="xs" style={styles.locationLabel}>
                Pickup Location
              </AppText>
              <AppText variant="caption" style={styles.locationAddress}>
                {pickupAddress}
              </AppText>
            </View>
          </View>

          {/* Right Side: Fare */}
          <View style={styles.fareSection}>
            <AppText variant="xs" style={styles.fareLabel}>
              Fare
            </AppText>
            <AppText variant="label" style={styles.fareAmount}>
              {ride.price}
            </AppText>
          </View>
        </View>

        {/* Location Connector */}
        <View style={styles.connectorContainer}>
          <View style={styles.dashedConnector}>
            {[...Array(1)].map((_, i) => (
              <View key={i} style={styles.dashSegment} />
            ))}
          </View>
        </View>

        {/* Destination Card */}
        <View style={styles.destinationCard}>
          <View
            style={[
              styles.locationDot,
              { backgroundColor: appColors.danger },
            ]}
          >
            <MapPin
              size={16}
              color={appColors.surfaceLight}
              strokeWidth={2.5}
            />
          </View>
          <View style={styles.locationContent}>
            <AppText variant="xs" style={styles.locationLabel}>
              Destination
            </AppText>
            <AppText variant="caption" style={styles.locationAddress}>
              {destinationAddress}
            </AppText>
          </View>
        </View>

        {/* Loading Overlay */}
        {isShowingLoadingOverlay && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={appColors.accent} />
            <AppText variant="body" style={styles.loadingText}>
              Completing Trip...
            </AppText>
          </View>
        )}


      
      </View>
    </BottomSheet2>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 12,
  },

  /* ── Ride Info Header ── */
  rideInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rideInfoTitle: {
    color: appColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rideInfoDistance: {
    color: appColors.textLight,
    fontWeight: '700',
    fontSize: 14,
  },

  /* ── Driver Distance Info ── */
  driverDistanceInfo: {
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: appColors.accent,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  driverDistanceLabel: {
    color: appColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  driverDistanceValue: {
    color: appColors.accent,
    fontWeight: '700',
    fontSize: 16,
  },

  errorContainer: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    borderRadius: 10,
    padding: 12,
    gap: 12,
    marginBottom: 12,
  },
  errorContent: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  errorTextContainer: {
    flex: 1,
    gap: 4,
  },
  errorTitle: {
    color: appColors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  errorMessage: {
    color: appColors.danger,
    lineHeight: 16,
  },

  /* ── Trip Card (Pickup & Fare) ── */
  tripCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
    gap: 12,
  },

  /* ── Location Section (Left Side) ── */
  locationSection: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  locationDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  locationContent: {
    flex: 1,
    gap: 4,
  },
  locationLabel: {
    color: appColors.textMuted,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  locationAddress: {
    color: appColors.textLight,
    lineHeight: 18,
  },

  /* ── Fare Section (Right Side) ── */
  fareSection: {
    alignItems: 'flex-end',
    gap: 4,
    paddingTop: 2,
  },
  fareLabel: {
    color: appColors.textMuted,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fareAmount: {
    color: appColors.accent,
    fontWeight: '700',
    fontSize: 16,
  },

  /* ── Location Connector ── */
  connectorContainer: {
    marginLeft: 16,
    marginVertical: 2,
  },
  dashedConnector: {
    flexDirection: 'column',
    gap: 2,
  },
  dashSegment: {
    width: 2,
    height: 3,
    backgroundColor: 'rgba(100, 116, 139, 0.5)',
    borderRadius: 1,
  },

  /* ── Destination Card ── */
  destinationCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
  },

  /* ── Trip Details ── */
  tripDetails: {
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailLabel: {
    color: appColors.textMuted,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    color: appColors.textLight,
    fontWeight: '600',
  },
  detailSeparator: {
    height: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.45)',
  },

  /* ── Action Buttons ── */
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emergencyBtn: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  actionLabel: {
    color: appColors.textLight,
    fontWeight: '600',
    fontSize: 12,
  },

  /* ── Loading Overlay ── */
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    borderRadius: 12,
  },
  loadingText: {
    color: appColors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
});
