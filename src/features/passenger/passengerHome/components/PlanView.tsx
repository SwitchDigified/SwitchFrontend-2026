import React from 'react';
import { ChevronDown, Timer } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { PlacesSearchInput } from '../../../../components/places';
import { AppText } from '../../../../components/ui/AppText';
import { GOOGLE_MAPS_DIRECTIONS_API_KEY } from '../../../../config/api';
import type { RideLocation, RideScheduleType } from '../../../../types/ride';
import { PICKUP_PLACES } from '../constants';
import { styles } from '../styles';

type PlanViewProps = {
  passengerName: string;
  pickupInputValue: string;
  error: string | null;
  scheduleType: RideScheduleType;
  onPickupInputChange: (value: string) => void;
  onSelectPickup: (location: RideLocation) => void;
  onToggleSchedule: () => void;
};

export function PlanView({
  passengerName,
  pickupInputValue,
  error,
  scheduleType,
  onPickupInputChange,
  onSelectPickup,
  onToggleSchedule,
}: PlanViewProps) {
  return (
    <>
      <AppText variant="lg" style={styles.greetingText}>
        Good Morning {passengerName}
      </AppText>

      <PlacesSearchInput
        apiKey={GOOGLE_MAPS_DIRECTIONS_API_KEY}
        value={pickupInputValue}
        onChangeText={onPickupInputChange}
        onPlaceSelected={onSelectPickup}
        placeholder="Set pickup location"
        variant="dark"
        errorText={error}
        rightAccessory={
          <Pressable
            onPress={onToggleSchedule}
            style={({ pressed }) => [
              styles.scheduleChip,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <Timer color="#dbeafe" size={13} />
            <AppText variant="xs" style={styles.scheduleChipText}>
              {scheduleType === 'later' ? 'Later' : 'Now'}
            </AppText>
            <ChevronDown color="#dbeafe" size={13} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.quickPlaceList}
        showsVerticalScrollIndicator={false}
      >
        {PICKUP_PLACES.map(place => {
          const Icon = place.icon;

          return (
            <Pressable
              key={place.id}
              onPress={() => onSelectPickup(place.location)}
              style={({ pressed }) => [
                styles.quickPlaceItem,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <View style={styles.quickPlaceIconWrap}>
                <Icon color="#dbeafe" size={14} />
              </View>
              <View style={styles.quickPlaceTextWrap}>
                <AppText variant="label" style={styles.quickPlaceTitle}>
                  {place.title}
                </AppText>
                <AppText variant="sm" style={styles.quickPlaceSubtitle}>
                  {place.subtitle}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <AppText variant="sm" style={styles.footerHint}>
        Select pickup location to continue to Your route
      </AppText>
    </>
  );
}
