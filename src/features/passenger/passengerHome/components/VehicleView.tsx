import React from 'react';
import { ChevronDown, MapPin, X } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { AppButton } from '../../../../components/ui/AppButton';
import { AppText } from '../../../../components/ui/AppText';
import type { RideLocation, RideType } from '../../../../types/ride';
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
  return (
    <ScrollView
      style={styles.vehicleScroll}
      contentContainerStyle={styles.vehicleContent}
      showsVerticalScrollIndicator={false}
    >

      <View style={styles.vehicleRouteCard}>
        <View style={styles.vehicleRouteTopRow}>
          <MapPin color="#dbeafe" size={15} />
          <View style={styles.vehicleRouteTextWrap}>
            <AppText variant="xs" style={styles.vehicleRouteLabel}>
              Start Location
            </AppText>
            <AppText variant="md" style={styles.vehicleRoutePrimaryValue}>
              {startSummary}
            </AppText>
          </View>
          <ChevronDown color="#94a3b8" size={15} />
        </View>

        <View style={styles.vehicleRouteDivider} />

        <View style={styles.vehicleRouteMiddleRow}>
          <View style={styles.routeDot} />
          <AppText
            variant="md"
            style={[
              styles.vehicleRouteMiddleText,
              !stopLocation ? styles.vehicleRoutePlaceholder : undefined,
            ]}
          >
            {stopSummary || 'add stop'}
          </AppText>
          <Pressable
            onPress={onClearStop}
            style={({ pressed }) => [
              styles.routeActionGhost,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <X color="#94a3b8" size={14} />
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
              Your Destination
            </AppText>
            <AppText variant="md" style={styles.vehicleRoutePrimaryValue}>
              {destinationSummary}
            </AppText>
          </View>
          <Pressable
            onPress={onClearDestination}
            style={({ pressed }) => [
              styles.routeActionGhost,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <X color="#94a3b8" size={14} />
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
        title={requestStatus === 'loading' ? 'Finding driver...' : 'Find Driver'}
        variant="ghost"
        onPress={onFindDriver}
        loading={requestStatus === 'loading'}
        disabled={!canFindDriver}
        style={styles.findDriverButton}
      />
    </ScrollView>
  );
}
