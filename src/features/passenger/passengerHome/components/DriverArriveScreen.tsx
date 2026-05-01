import React, { memo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import {
  Bell,
  CarFront,
  ChevronDown,
  Circle,
  MapPin,
  MessageCircleMore,
  PhoneCall,
  Wallet2,
} from 'lucide-react-native';
import type { Region } from 'react-native-maps';

import { AppButton } from '../../../../components/ui/AppButton';
import { AppText } from '../../../../components/ui/AppText';
import type { RideLocation, RideType } from '../../../../types/ride';
import { getScreenTitle } from '../utils';
import { PlannerLayout } from './PlannerLayout';
import { styles } from '../styles';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { showError, showSuccess } from '../../../../store/toastSlice';
import { ridesApi } from '../../../../api/apiClient';

type DriverArriveScreenProps = {
  visible?: boolean;
  topInset: number;
  bottomInset: number;
  mapRegion: Region;
  pickupLocation: RideLocation | null;
  stopLocation: RideLocation | null;
  destinationLocation: RideLocation | null;
  rideType: RideType;
  switchCoinBalance: number;
  paymentMethod: string;
  driverName: string;
  avatarLabel?: string;
  currentScreen?: 'accepted' | 'arrived';
  driverAvatarUrl?: string | null;
  driverRating?: number;
  completedTrips?: number;
  etaMinutes?: number;
  vehicleDescription?: string;
  vehiclePlate?: string;
  onBackPress: () => void;
  onCallDriver?: () => void;
  onOpenChat?: () => void;
  onOpenNotifications?: () => void;
  onChangePaymentMethod?: () => void;
  onCancelRide: () => void;
  cancelLoading: boolean;
};

function DriverArriveScreenComponent({
  visible = true,
  topInset,
  bottomInset,
  mapRegion,
  pickupLocation,
  stopLocation,
  destinationLocation,
  rideType,
  switchCoinBalance,
  paymentMethod,
  driverName,
  avatarLabel = 'ME',
  currentScreen = 'arrived',
  driverAvatarUrl,
  driverRating = 4.9,
  completedTrips = 1599,
  etaMinutes = 5,
  vehicleDescription = 'Honda Civic • Black',
  vehiclePlate = 'ABJ911NV',
  onBackPress,
  onCallDriver,
  onOpenChat,
  onOpenNotifications,
  onChangePaymentMethod,
}: DriverArriveScreenProps) {
  if (!visible) {
    return null;
  }
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rideData = useAppSelector((state) => state.ride);
  const authState = useAppSelector((state) => state.auth);
  const sessionUser = authState?.session?.user;
  const activeRideId =
    rideData?.latestRide?.id ??
    (sessionUser && 'activeRideId' in sessionUser ? sessionUser.activeRideId : null);
  const startAddress = pickupLocation?.address ?? 'Afri Hotel, CBD';
  const stopAddress = stopLocation?.address ?? 'Utako Modern Market, Utako';
  const destinationAddress = destinationLocation?.address ?? 'Alpha Estate, Wuye';
  const vehicleTitle = rideType === 'shared' ? 'Switch Cab Regular' : 'Switch Cab Medium';
  const paymentTitle = paymentMethod === 'cash' ? 'Cash Payment' : 'Switch Wallet';
  const coinCopy = `You have ${switchCoinBalance.toLocaleString()} Switch Coins`;
  const driverInitials =
    driverName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'DR';



        const onCancelRide = async () => {
          // Validate required data
          if (!activeRideId) {
            dispatch(showError({ message: 'No active ride found to cancel' }));
            return;
          }
      
          if (!sessionUser?.id) {
            dispatch(showError({ message: 'User not authenticated' }));
            return;
          }
      
          try {
            setIsLoading(true);
            setError(null);
            
            await ridesApi.cancelRide(activeRideId, sessionUser.id, 'passenger');
            
            dispatch(showSuccess({ message: 'Ride cancelled successfully' }));
            // Success - parent component will handle navigation
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to cancel ride';
            setError(errorMessage);
            dispatch(showError({ message: errorMessage }));
            console.error('[FindingView] Error canceling ride:', err);
          } finally {
            setIsLoading(false);
          }
        };

  return (
    <PlannerLayout
      title={getScreenTitle(currentScreen)}
      avatarLabel={avatarLabel}
      mapRegion={mapRegion}
      pickupLocation={pickupLocation}
      stopLocation={stopLocation}
      destinationLocation={destinationLocation}
      showPolyline={true}
      topInset={topInset}
      bottomInset={bottomInset}
      isVehicleScreen={false}
      currentScreen={currentScreen}
      onBackPress={onBackPress}
    >
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.driverArriveSheetBodyContent,
          { paddingBottom: Math.max(48, bottomInset + 28) },
        ]}
      >
        <View style={styles.driverArriveEtaStrip}>
          <AppText variant="sm" style={styles.driverArriveEtaText}>
            {driverName.split(' ')[0]} will arrive in {etaMinutes} minutes
          </AppText>
        </View>

        <View style={styles.driverArrivePrimaryPanel}>
          <View style={styles.driverArriveVehicleCard}>
            <View style={styles.driverArriveVehicleBadge}>
              <CarFront color="#facc15" size={22} strokeWidth={2} />
              <View style={styles.driverArriveSeatBadge}>
                <AppText variant="xs" style={styles.driverArriveSeatBadgeText}>
                  {rideType === 'shared' ? '4' : '2'}
                </AppText>
              </View>
            </View>

            <View style={styles.driverArriveVehicleMeta}>
              <AppText variant="md" style={styles.driverArriveVehicleTitle}>
                {vehicleTitle}
              </AppText>
              <AppText variant="xs" style={styles.driverArriveVehicleSubtitle}>
                {vehicleDescription} · {vehiclePlate}
              </AppText>
            </View>

            <AppText variant="xl" style={styles.driverArriveVehiclePrice}>
              NGN 5,500
            </AppText>
          </View>

          <View style={styles.driverArriveDriverCard}>
            <View style={styles.driverArriveDriverMain}>
              <View style={styles.driverArriveDriverAvatar}>
                {driverAvatarUrl ? (
                  <Image source={{ uri: driverAvatarUrl }} style={styles.driverArriveDriverAvatarImage} />
                ) : (
                  <AppText variant="sm" style={styles.driverArriveDriverAvatarLabel}>
                    {driverInitials}
                  </AppText>
                )}

                <View style={styles.driverArriveRatingBadge}>
                  <AppText variant="xs" style={styles.driverArriveRatingText}>
                    {driverRating.toFixed(1)}
                  </AppText>
                </View>
              </View>

              <View style={styles.driverArriveDriverMeta}>
                <AppText variant="md" style={styles.driverArriveDriverName}>
                  {driverName}
                </AppText>
                <View style={styles.driverArriveDriverSubRow}>
                  <AppText variant="xs" style={styles.driverArriveDriverSubtext}>
                    Top Rated Driver
                  </AppText>
                  <AppText
                    variant="xs"
                    style={[
                      styles.driverArriveDriverSubtext,
                      { marginLeft: 8, color: '#fff', textDecorationLine: 'underline' },
                    ]}
                  >
                    {completedTrips} rides
                  </AppText>
                </View>
              </View>
            </View>

            <View style={styles.driverArriveActionRow}>
              <Pressable
                onPress={onCallDriver}
                style={({ pressed }) => [
                  styles.driverArriveActionButton,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <PhoneCall color="#f8fafc" size={17} />
              </Pressable>

              <Pressable
                onPress={onOpenChat}
                style={({ pressed }) => [
                  styles.driverArriveActionButton,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <MessageCircleMore color="#f8fafc" size={17} />
              </Pressable>

              <Pressable
                onPress={onOpenNotifications}
                style={({ pressed }) => [
                  styles.driverArriveActionButton,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Bell color="#f8fafc" size={17} />
                <View style={styles.driverArriveAlertBadge}>
                  <AppText variant="xs" style={styles.driverArriveAlertBadgeText}>
                    2
                  </AppText>
                </View>
              </Pressable>
            </View>
          </View>

          <View style={styles.driverArriveRouteCard}>
            <View style={styles.driverArriveRouteRow}>
              <MapPin color="#cfe4df" size={14} />
              <View style={styles.driverArriveRouteCopy}>
                <AppText variant="xs" style={styles.driverArriveRouteLabel}>
                  Start Location
                </AppText>
                <AppText variant="md" style={styles.driverArriveRouteValue}>
                  {startAddress}
                </AppText>
              </View>
              <ChevronDown color="#8db6af" size={16} />
            </View>

            <View style={styles.driverArriveRouteDivider} />

            <View style={styles.driverArriveRouteRow}>
              <Circle color="#dbe9e6" size={12} strokeWidth={2.5} />
              <View style={styles.driverArriveRouteCopy}>
                <AppText variant="md" style={styles.driverArriveRouteValue}>
                  {stopAddress}
                </AppText>
              </View>
              <AppText variant="sm" style={styles.driverArriveRouteAction}>
                ×
              </AppText>
              <View style={styles.driverArriveAddStop}>
                <AppText variant="xs" style={styles.driverArriveAddStopText}>
                  +
                </AppText>
              </View>
            </View>

            <View style={styles.driverArriveRouteDivider} />

            <View style={styles.driverArriveRouteRow}>
              <View style={styles.driverArriveDestinationDot} />
              <View style={styles.driverArriveRouteCopy}>
                <AppText variant="xs" style={styles.driverArriveRouteLabel}>
                  Your Destination
                </AppText>
                <AppText variant="md" style={styles.driverArriveRouteValue}>
                  {destinationAddress}
                </AppText>
              </View>
              <AppText variant="sm" style={styles.driverArriveRouteAction}>
                ×
              </AppText>
            </View>
          </View>

          <View style={styles.driverArriveSectionHeader}>
            <AppText variant="lg" style={styles.driverArriveSectionTitle}>
              Payment Method
            </AppText>
          </View>

          <View style={styles.driverArrivePaymentCard}>
            <View style={styles.driverArrivePaymentBadge}>
              <Wallet2 color="#d8ece7" size={16} />
            </View>

            <View style={styles.driverArrivePaymentCopy}>
              <AppText variant="lg" style={styles.driverArrivePaymentTitle}>
                {paymentTitle}
              </AppText>
              <AppText variant="sm" style={styles.driverArrivePaymentSubtitle}>
                {coinCopy}
              </AppText>
            </View>

            <Pressable
              onPress={onChangePaymentMethod}
              style={({ pressed }) => [
                styles.driverArrivePaymentAction,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <AppText variant="xs" style={styles.driverArrivePaymentActionText}>
                Change
              </AppText>
            </Pressable>
          </View>

          <AppButton
            title={isLoading ? 'Cancelling...' : 'Cancel Ride'}
            variant="danger"
            onPress={onCancelRide}
            loading={isLoading}
            style={styles.driverArriveCancelButton}
          />
        </View>
      </ScrollView>
    </PlannerLayout>
  );
}

export const DriverArriveScreen = memo(DriverArriveScreenComponent);
