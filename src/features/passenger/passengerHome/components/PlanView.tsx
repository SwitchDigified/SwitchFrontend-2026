import React, { useEffect, useState } from 'react';
import { ChevronDown, Clock, Timer } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { PlacesSearchInput } from '../../../../components/places';
import { AppText } from '../../../../components/ui/AppText';
import { GOOGLE_MAPS_DIRECTIONS_API_KEY } from '../../../../config/api';
import type { RideLocation, RideScheduleType } from '../../../../types/ride';
import { getRecentPlaces, type RecentPlace } from '../../../../utils/storage';
import { styles } from '../styles';

type PlanViewProps = {
  passengerName: string;
  pickupInputValue: string;
  error: string | null;
  scheduleType: RideScheduleType;
  recentPlaces?: RecentPlace[];
  onPickupInputChange: (value: string) => void;
  onSelectPickup: (location: RideLocation) => void;
  onToggleSchedule: () => void;
};

const getTimeBasedGreeting = (hour: number): string => {
  if (hour >= 5 && hour < 12) {
    return 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good Afternoon';
  } else if (hour >= 17 && hour < 21) {
    return 'Good Evening';
  } else {
    return 'Good Night';
  }
};

export function PlanView({
  passengerName,
  pickupInputValue,
  error,
  scheduleType,
  recentPlaces: propRecentPlaces,
  onPickupInputChange,
  onSelectPickup,
  onToggleSchedule,
}: PlanViewProps) {
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);

  useEffect(() => {
    if (propRecentPlaces) {
      setRecentPlaces(propRecentPlaces);
    } else {
      loadRecentPlaces();
    }
  }, [propRecentPlaces]);

  const loadRecentPlaces = async () => {
    const places = await getRecentPlaces();
    setRecentPlaces(places);
  };

  const placesToDisplay = recentPlaces.map((place) => ({
    id: place.placeId || place.address,
    title: place.address,
    subtitle: '',
    icon: Clock,
    location: {
      address: place.address,
      placeId: place.placeId,
      coordinates: place.coordinates,
    } as RideLocation,
  }));

  const currentHour = new Date().getHours();
  const greeting = getTimeBasedGreeting(currentHour);

  return (
    <View style={{padding:16, gap:12}}>
      <AppText variant="lg" style={styles.greetingText}>
        {greeting} {passengerName}
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

      {recentPlaces.length > 0 && (
        <View style={{ marginTop: 12, marginBottom: 8, gap: 8 }}>
          <AppText variant="sm" style={{ marginBottom: 4, color: '#cbd5e1', fontWeight: '600' }}>
            Recent Places
          </AppText>
          <View style={{ gap: 8 }}>
            {placesToDisplay.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => onSelectPickup(place.location)}
                style={({ pressed }) => [
                  {
                    backgroundColor: 'rgba(2, 48, 50, 0.95)',
                    borderColor: '#0b5f61',
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  },
                  pressed ? { opacity: 0.75 } : undefined,
                ]}
              >
                <Clock color="#cbd5e1" size={12} />
                <View style={{ flex: 1 }}>
                  <AppText
                    variant="xs"
                    style={{
                      color: '#f8fafc',
                    }}
                    numberOfLines={2}
                  >
                    {place.title}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <AppText variant="sm" style={styles.footerHint}>
        Select pickup location to continue to Your route
      </AppText>
    </View>
  );
}
