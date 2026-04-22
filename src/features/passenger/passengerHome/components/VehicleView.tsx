import React, { useState } from 'react';
import { ChevronDown, MapPin, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppButton } from '../../../../components/ui/AppButton';
import { AppText } from '../../../../components/ui/AppText';
import { ridesApi } from '../../../../api/apiClient';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { updatePassengerRideState } from '../../../../store/authSlice';
import { setRide } from '../../../../store/rideSlice';
import { showError, showSuccess } from '../../../../store/toastSlice';
import type { CreateRideRequestPayload, RideLocation, RideType } from '../../../../types/ride';
import { DESTINATION_PLACES, PAYMENT_OPTIONS, VEHICLE_OPTIONS } from '../constants';
import { styles } from '../styles';

type VehicleViewProps = {
  startSummary: string;
  stopSummary: string;
  destinationSummary: string;
  rideType: RideType;
  paymentMethod: string;
  requestStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  showStopPicker: boolean;
  stopLocation: RideLocation | null;
  onClearStop: () => void;
  onToggleStopPicker: () => void;
  onClearDestination: () => void;
  onSelectStopLocation: (location: RideLocation) => void;
  onSelectVehicleOption: (rideType: RideType) => void;
  onSelectPaymentMethod: (paymentMethod: string) => void;
  onFindDriver: () => void;
  canFindDriver: boolean;
};

export function VehicleView({
  startSummary,
  stopSummary,
  destinationSummary,
  rideType,
  paymentMethod,
  requestStatus,
  showStopPicker,
  stopLocation,
  onClearStop,
  onToggleStopPicker,
  onClearDestination,
  onSelectStopLocation,
  onSelectVehicleOption,
  onSelectPaymentMethod,
  onFindDriver,
  canFindDriver,
}: VehicleViewProps) {

    const dispatch = useAppDispatch();
    const sessionUser = useAppSelector((state) => state.auth.session?.user);
    const {
      pickupLocation,
      destinationLocation,
      scheduleType,
      scheduledPickupAt,
      latestRide,
    } = useAppSelector((state) => state.ride);
    const [isCreating, setIsCreating] = useState(false);

    const sanitizeRideLocation = (location: RideLocation): RideLocation => {
      const sanitizedPlaceId =
        typeof location.placeId === 'string' && location.placeId.trim().length > 0
          ? location.placeId.trim()
          : undefined;

      return {
        address: location.address,
        ...(sanitizedPlaceId ? { placeId: sanitizedPlaceId } : {}),
        coordinates: location.coordinates,
      };
    };
  
  const createRide = async () => {
      if (!sessionUser || sessionUser.role !== 'passenger') {
        dispatch(showError({ message: 'Only an authenticated passenger can request a ride.' }));
        return;
      }

      if (!pickupLocation) {
        dispatch(showError({ message: 'Select your pickup location to continue.' }));
        return;
      }

      if (!destinationLocation) {
        dispatch(showError({ message: 'Select your destination to continue.' }));
        return;
      }

      const schedule: CreateRideRequestPayload['schedule'] =
        scheduleType === 'later'
          ? {
              type: 'later',
              pickupAt:
                scheduledPickupAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            }
          : { type: 'now' };

      const payload: CreateRideRequestPayload = {
        passengerId: sessionUser.id,
        rideType,
        pickupLocation: sanitizeRideLocation(pickupLocation),
        stopLocation: stopLocation ? sanitizeRideLocation(stopLocation) : undefined,
        destinationLocation: sanitizeRideLocation(destinationLocation),
        paymentMethod,
        rider: {
          id: sessionUser.id,
          firstName: sessionUser.firstName,
          lastName: sessionUser.lastName,
          phone: sessionUser.phone,
          email: sessionUser.email,
        },
        driver: null,
        schedule,
        currentRideStatus: latestRide?.status ?? null,
      };

      try {
        setIsCreating(true);
        const rideResponse = await ridesApi.createRideRequest(payload);
        const ride = (rideResponse as { data?: any })?.data ?? rideResponse;
        dispatch(setRide(ride));
        dispatch(
          updatePassengerRideState({
            rideStatus: 'requested',
            activeRideId: ride.id,
          })
        );
        dispatch(showSuccess({ message: 'Ride request created. Finding a driver...' }));
        onFindDriver();
      } catch (error) {
        const errorMessage =
          (error as any)?.response?.data?.message ??
          (error as any)?.message ??
          'Failed to request a ride';
        console.error('[VehicleView] Error creating ride request:', errorMessage);
        dispatch(showError({ message: errorMessage, duration: 5000 }));
      } finally {
        setIsCreating(false);
      }
  };

    const isRequesting = requestStatus === 'loading' || isCreating;

  return (
    <View style={{padding:16, gap:2}}>

      <View style={[styles.vehicleRouteCard, ]}>
        <View style={styles.vehicleRouteTopRow}>
          <MapPin color="#dbeafe" size={12} />
          <View style={styles.vehicleRouteTextWrap}>
            <AppText variant="xs" style={styles.vehicleRouteLabel}>
              Start
            </AppText>
            <AppText variant="xs" style={styles.vehicleRoutePrimaryValue} numberOfLines={1}>
              {startSummary?.substring(0, 40)}
            </AppText>
          </View>
          <ChevronDown color="#94a3b8" size={12} />
        </View>

        <View style={styles.vehicleRouteDivider} />

        <View style={styles.vehicleRouteMiddleRow}>
          <View style={styles.routeDot} />
          <AppText
            variant="xs"
            style={[
              styles.vehicleRouteMiddleText,
              !stopLocation ? styles.vehicleRoutePlaceholder : undefined,
            ]}
            numberOfLines={1}
          >
            {(stopSummary?.substring(0, 40)) || 'add stop'}
          </AppText>
          <Pressable
            onPress={onClearStop}
            style={({ pressed }) => [
              styles.routeActionGhost,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <X color="#94a3b8" size={12} />
          </Pressable>
          <Pressable
            onPress={onToggleStopPicker}
            style={({ pressed }) => [
              styles.routeActionCircle,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <AppText variant="label" style={styles.routeActionPlusText}>
              +
            </AppText>
          </Pressable>
        </View>

        <View style={styles.vehicleRouteDivider} />

        <View style={styles.vehicleRouteBottomRow}>
          <View style={styles.routeDestinationIconWrap}>
            <View style={styles.routeDestinationDot} />
          </View>
          <View style={styles.vehicleRouteTextWrap}>
            <AppText variant="xs" style={styles.vehicleRouteLabel}>
              Destination
            </AppText>
            <AppText variant="xs" style={styles.vehicleRoutePrimaryValue} numberOfLines={1}>
              {destinationSummary?.substring(0, 40)}
            </AppText>
          </View>
          <Pressable
            onPress={onClearDestination}
            style={({ pressed }) => [
              styles.routeActionGhost,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <X color="#94a3b8" size={12} />
          </Pressable>
        </View>
      </View>

      {showStopPicker ? (
        <View style={styles.stopPickerCard}>
          <AppText variant="sm" style={styles.stopPickerTitle}>
            Pick stop location
          </AppText>
          {DESTINATION_PLACES.map(place => (
            <Pressable
              key={`stop-${place.id}`}
              onPress={() => onSelectStopLocation(place.location)}
              style={({ pressed }) => [
                styles.stopPickerItem,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <AppText variant="label" style={styles.stopPickerItemTitle}>
                {place.title}
              </AppText>
              <AppText variant="xs" style={styles.stopPickerItemSubtitle}>
                {place.subtitle}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <AppText variant="lg" style={styles.sectionHeading}>
        Available Options
      </AppText>

      <View style={styles.vehicleList}>
        {VEHICLE_OPTIONS.map(option => {
          const isActive = option.rideType === rideType;

          return (
            <Pressable
              key={option.id}
              onPress={() => onSelectVehicleOption(option.rideType)}
              style={({ pressed }) => [
                styles.vehicleCard,
                isActive ? styles.vehicleCardActive : undefined,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <View style={styles.vehicleBadgeWrap}>
                <AppText variant="lg" style={styles.vehicleBadge}>
                  {option.badge}
                </AppText>
              </View>

              <View style={styles.vehicleTextWrap}>
                <AppText variant="label" style={styles.vehicleTitle}>
                  {option.title}
                </AppText>
                <AppText variant="sm" style={styles.vehicleSubtitle}>
                  {option.subtitle}
                </AppText>
              </View>

              <AppText variant="lg" style={styles.vehiclePrice}>
                {option.price}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <AppText variant="lg" style={styles.sectionHeading}>
        Payment Method
      </AppText>

      <View style={styles.paymentList}>
        {PAYMENT_OPTIONS.map(option => {
          const isActive = paymentMethod === option.id;

          return (
            <Pressable
              key={option.id}
              onPress={() => onSelectPaymentMethod(option.id)}
              style={({ pressed }) => [
                styles.paymentCard,
                isActive ? styles.paymentCardActive : undefined,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <View style={styles.paymentTextWrap}>
                <AppText variant="label" style={styles.paymentTitle}>
                  {option.title}
                </AppText>
                <AppText variant="sm" style={styles.paymentSubtitle}>
                  {option.subtitle}
                </AppText>
              </View>

              <ChevronDown
                color={isActive ? '#5eead4' : '#93c5fd'}
                size={16}
              />
            </Pressable>
          );
        })}
      </View>

      <AppButton
          title={isRequesting ? 'Requesting a ride...' : 'Request Ride'}
        variant="ghost"
        onPress={createRide}
          loading={isRequesting}
        disabled={!canFindDriver}
        style={styles.findDriverButton}
      />
    </View>
  );
}
