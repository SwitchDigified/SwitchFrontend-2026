import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import {
  MapPin,
  Phone,
  MessageCircle,
  X,
  CreditCard,
  User,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../ui/AppText';
import { appColors } from '../../theme/colors';
import { BottomSheet2 } from '../../features/passenger/passengerHome/components/planner_sheets';
import { useCalculateDistance } from '../../hooks/useCalculateDistance';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { showSuccess, showError } from '../../store/toastSlice';
import { ridesApi } from '../../api/apiClient';
import type { RideRequest } from '../../types/ride';
import { DriverActiveRide } from '../../listeners';

type RideAcceptedSheetProps = {
  visible: boolean;
  ride: DriverActiveRide | null;
 
  isLoading?: boolean;
};

export const RideAcceptedSheet = ({
  visible,
  ride,
  isLoading = false,
}: RideAcceptedSheetProps) => {
  console.log("RIDEREQUESTSHEET", ride)
  const [isStarting, setIsStarting] = useState(false);
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const driverLocation = useAppSelector((state) => state.driverLocation.currentLocation);
  const driverId = useAppSelector((state) => state.auth.session?.user.id);
  
  // Get the full ride data from Redux store



  // Distance from pickup to destination
  const { distanceString, timeRemaining } = useCalculateDistance(
    ride?.pickupLocation.coordinates,
    ride?.destinationLocation.coordinates
  );

  // Distance from driver location to pickup location
  const { distanceString: driverToPickupDistance } = useCalculateDistance(
    driverLocation,
    ride?.pickupLocation.coordinates
  );

  if (!ride) return null;


  const handleStartTrip = async () => {
    if (!driverId) {
      dispatch(showError({ message: 'Driver not authenticated. Please log in again.' }));
      return;
    }
    try {
      setIsStarting(true);
      const data = await ridesApi.startTrip({
        rideId: ride.id,
        driverId,
      });
      console.log('[RideAcceptedSheet] Trip started:', data);
      dispatch(showSuccess({ message: 'Trip started successfully' }));
      // await onStartTrip();
    } catch (error) {
      const errorMessage = (error as any)?.response?.data?.message ?? (error as any)?.message ?? 'Failed to start trip';
      console.error('[RideAcceptedSheet] Error starting trip:', errorMessage);
      dispatch(showError({ message: errorMessage, duration: 5000 }));
    } finally {
      setIsStarting(false);
    }
  };

  const handleCall = () => {
    if (ride.rider.phone) Linking.openURL(`tel:${ride.rider.phone}`);
  };

  const handleMessage = () => {
    if (ride.rider.phone) Linking.openURL(`sms:${ride.rider.phone}`);
  };

  const initial = ride.rider.firstName?.charAt(0)?.toUpperCase() ?? '?';
  const isButtonDisabled = isStarting || isLoading;
  const isShowingLoadingOverlay = isStarting || isLoading;


        const onCancelRide = async () => {
          // Validate required data
          // if (!activeRideId) {
          //   dispatch(showError({ message: 'No active ride found to cancel' }));
          //   return;
          // }
      
          // if (!sessionUser?.id) {
          //   dispatch(showError({ message: 'User not authenticated' }));
          //   return;
          // }
      
          // try {
          //   setIsLoading(true);
          //   setError(null);
            
          //   await ridesApi.cancelRide(activeRideId, sessionUser.id, 'passenger');
            
          //   dispatch(showSuccess({ message: 'Ride cancelled successfully' }));
          //   // Success - parent component will handle navigation
          // } catch (err) {
          //   const errorMessage = err instanceof Error ? err.message : 'Failed to cancel ride';
          //   setError(errorMessage);
          //   dispatch(showError({ message: errorMessage }));
          //   console.error('[FindingView] Error canceling ride:', err);
          // } finally {
          //   setIsLoading(false);
          // }
        };

  return (
    <BottomSheet2
      visible={visible}
      onClose={()=>{}}
      snapPoints={[0, 180]}
      allowSheetDrag={true}
      showButton={true}
      buttonType="swipe action button"
      buttonLabel={isShowingLoadingOverlay ? 'STARTING TRIP...' : 'SWIPE TO START TRIP'}
      isLoading={isShowingLoadingOverlay}
      onPressAction={handleStartTrip}
      height={560}
  //       buttons={[
  //   {
  //     label: 'Confirm',
  //     variant: 'green',
  //     onPress: ()=>{},
  //     loading: false,
  //   },
  //   {
  //     label: 'Cancel',
  //     variant: 'white',
  //     onPress:()=>{},
  //   },
  //   {
  //     label: 'Delete',
  //     variant: 'danger',
  //     onPress:()=>{},
  //   },
  // ]}
    >
      <View
        style={[
          styles.container,
          { paddingBottom: Math.max(16, insets.bottom + 4) },
        ]}
      >
        {/* Passenger Info Header */}
        <View style={styles.passengerCard}>
          <View style={styles.avatar}>
            <AppText variant="lg" style={styles.avatarInitial}>
              {initial}
            </AppText>
          </View>
          <View style={styles.passengerInfo}>
            <View style={styles.nameRatingRow}>
              <View>
                <AppText variant="label" style={styles.passengerName}>
                  {ride.rider.firstName} {ride.rider.lastName}
                </AppText>
                <AppText variant="caption" style={styles.passengerHandle}>
                  @{ride.rider.firstName?.toLowerCase() || 'rider'}
                </AppText>
              </View>

              <View style={styles.ratingBadge}>
                <AppText variant="caption" style={styles.ratingStar}>
                  ★
                </AppText>
                <AppText variant="caption" style={styles.ratingText}>
                  {ride.rider.ratings?.average.toFixed(1) || 'N/A'}
                </AppText>
              </View>
            </View>

            <View style={styles.pickupInfoSection}>
              <AppText style={styles.pickupLabel} variant="caption">
                Pickup Location
              </AppText>
              <AppText variant="caption" style={styles.pickupAddressText}>
                {ride.pickupLocation.address}
              </AppText>
            </View>
          </View>
        </View>

        {/* Ride Info & Locations Card */}
        <View style={styles.locationsCard}>
          <View style={styles.rideInfoHeader}>
            <AppText variant="label" style={styles.rideInfoTitle}>
              Ride Info
            </AppText>
            <AppText variant="caption" style={styles.rideInfoDistance}>
              {distanceString} ({timeRemaining})
            </AppText>
          </View>

          {/* Pickup Location */}
          <View style={styles.locationRow}>
            <View
              style={[
                styles.locationDot,
                { backgroundColor: appColors.accent },
              ]}
            >
              <MapPin size={14} color="#111" strokeWidth={2.5} />
            </View>
            <AppText variant="caption" style={styles.locationText}>
              {ride.pickupLocation.address}
            </AppText>
          </View>

          {/* Dashed connector */}
          <View style={styles.dashedConnector}>
            {[...Array(1)].map((_, i) => (
              <View key={i} style={styles.dashSegment} />
            ))}
          </View>

          {/* Destination Location */}
          <View style={styles.locationRow}>
            <View
              style={[
                styles.locationDot,
                { backgroundColor: appColors.danger },
              ]}
            >
              <MapPin
                size={14}
                color={appColors.surfaceLight}
                strokeWidth={2.5}
              />
            </View>
            <View style={styles.destinationRow}>
              <AppText variant="caption" style={styles.locationText}>
                {ride.destinationLocation.address}
              </AppText>
              <View style={styles.timerBadge}>
                <AppText variant="xs" style={styles.timerText}>
                  {driverToPickupDistance}
                </AppText>
              </View>
            </View>
          </View>
        </View>

        {/* Details Grid */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <AppText variant="xs" style={styles.detailLabel}>
              Payment Via
            </AppText>
            <View style={styles.detailValueRow}>
              <CreditCard
                size={13}
                color={appColors.textMuted}
                strokeWidth={2}
              />
              <AppText variant="body" style={styles.detailValue}>
                {ride.paymentMethod}
              </AppText>
            </View>
          </View>

          <View style={styles.detailSeparator} />

          <View style={styles.detailItem}>
            <AppText variant="xs" style={styles.detailLabel}>
              Ride For
            </AppText>
            <View style={styles.detailValueRow}>
              <User size={13} color={appColors.textMuted} strokeWidth={2} />
              <AppText variant="body" style={styles.detailValue}>
                1 person
              </AppText>
            </View>
          </View>

          <View style={styles.detailSeparator} />

          <View style={styles.detailItem}>
            <AppText variant="xs" style={styles.detailLabel}>
              Ride Fare
            </AppText>
            <AppText
              variant="body"
              style={[styles.detailValue, { color: appColors.accent }]}
            >
             {ride.price}
            </AppText>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleCall}
            activeOpacity={0.7}
            disabled={isButtonDisabled}
          >
            <Phone size={18} color={appColors.textLight} strokeWidth={2} />
            <AppText variant="xs" style={styles.actionLabel}>
              Call now
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleMessage}
            activeOpacity={0.7}
            disabled={isButtonDisabled}
          >
            <MessageCircle
              size={18}
              color={appColors.textLight}
              strokeWidth={2}
            />
            <AppText variant="xs" style={styles.actionLabel}>
              Message
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            // onPress={onCancelRide}
            disabled={isButtonDisabled}
            activeOpacity={0.7}
          >
            <X size={18} color={appColors.danger} strokeWidth={2.5} />
            <AppText
              variant="xs"
              style={[styles.actionLabel, { color: appColors.danger }]}
            >
              Cancel
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Loading Overlay */}
        {isShowingLoadingOverlay && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={appColors.accent} />
            <AppText variant="body" style={styles.loadingText}>
              Starting Trip...
            </AppText>
          </View>
        )}
      </View>
    </BottomSheet2>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },

  /* ── Passenger Card ── */
  passengerCard: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: 'teal',
    padding: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(100, 116, 139, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: appColors.textLight,
    fontWeight: '700',
  },
  passengerInfo: {
    flex: 1,
    gap: 8,
  },
  nameRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passengerName: {
    color: appColors.textLight,
  },
  passengerHandle: {
    color: appColors.textMuted,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 78, 59, 0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingStar: {
    color: '#f9a825',
    fontSize: 12,
  },
  ratingText: {
    color: appColors.textLight,
    fontWeight: '600',
  },
  pickupInfoSection: {
    gap: 4,
  },
  pickupLabel: {
    color: '#FFFFFF',
    opacity: 0.7,
  },
  pickupAddressText: {
    color: '#FFFFFF',
  },

  /* ── Ride Info Header ── */
  rideInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rideInfoTitle: {
    color: appColors.textLight,
    fontSize: 16,
  },
  rideInfoDistance: {
    color: appColors.accent,
    fontWeight: '700',
  },

  /* ── Locations Card ── */
  locationsCard: {
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
    padding: 12,
    borderRadius: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
  locationText: {
    flex: 1,
    color: appColors.textLight,
    lineHeight: 20,
    paddingTop: 6,
  },
  destinationRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dashedConnector: {
    flexDirection: 'column',
    gap: 3,
    marginLeft: 16,
    marginVertical: 6,
  },
  dashSegment: {
    width: 2,
    height: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.5)',
    borderRadius: 1,
  },
  timerBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  timerText: {
    color: appColors.textLight,
    fontWeight: '600',
  },

  /* ── Details Grid ── */
  detailsGrid: {
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    borderRadius: 12,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  detailLabel: {
    color: appColors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontSize: 10,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailValue: {
    color: appColors.textLight,
    fontWeight: '600',
  },
  detailSeparator: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(100, 116, 139, 0.45)',
  },

  /* ── Action Buttons ── */
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.45)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionLabel: {
    color: appColors.textLight,
    fontWeight: '600',
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
