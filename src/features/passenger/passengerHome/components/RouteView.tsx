import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Clock } from 'lucide-react-native';

import { PlacesSearchInput } from '../../../../components/places';
import { AppButton } from '../../../../components/ui/AppButton';
import { AppText } from '../../../../components/ui/AppText';
import { GOOGLE_MAPS_DIRECTIONS_API_KEY } from '../../../../config/api';
import type { RideLocation } from '../../../../types/ride';
import { addRecentPlace, getRecentPlaces, type RecentPlace } from '../../../../utils/storage';
import { DESTINATION_PLACES } from '../constants';
import { styles } from '../styles';

type RouteViewProps = {
  pickupAddress: string;
  destinationInputValue: string;
  error: string | null;
  canContinueToVehicle: boolean;
  onDestinationInputChange: (value: string) => void;
  onSelectDestination: (location: RideLocation) => void;
  onContinue: () => void;
};

export function RouteView({
  pickupAddress,
  destinationInputValue,
  error,
  canContinueToVehicle,
  onDestinationInputChange,
  onSelectDestination,
  onContinue,
}: RouteViewProps) {
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);

  useEffect(() => {
    loadRecentPlaces();
  }, []);

  const loadRecentPlaces = async () => {
    const places = await getRecentPlaces();
    setRecentPlaces(places);
  };

  const handleSelectDestination = async (location: RideLocation) => {
    // Update recent places storage
    const updated = await addRecentPlace(location);
    setRecentPlaces(updated);
    // Call parent handler
    onSelectDestination(location);
  };

  return (
    <>
      <View style={styles.routeCard}>
        <View style={styles.routeRow}>
          <AppText variant="xs" style={styles.routeLabel}>
            Start location
          </AppText>
          <AppText variant="label" style={styles.routeValue}>
            {pickupAddress}
          </AppText>
        </View>

        <View style={styles.routeDivider} />

        <View style={styles.routeRow}>
          <AppText variant="xs" style={styles.routeLabel}>
            Your destination
          </AppText>
          <AppText variant="label" style={styles.routeValue}>
            {destinationInputValue || 'Choose a destination below'}
          </AppText>
        </View>
      </View>

      <PlacesSearchInput
        apiKey={GOOGLE_MAPS_DIRECTIONS_API_KEY}
        value={destinationInputValue}
        onChangeText={onDestinationInputChange}
        onPlaceSelected={handleSelectDestination}
        placeholder="Your destination"
        variant="dark"
        errorText={error}
      />

      {recentPlaces.length > 0 && (
        <View style={{ marginTop: 16, marginBottom: 16, gap: 8 }}>
          <AppText variant="sm" style={{ marginBottom: 4, color: '#cbd5e1', fontWeight: '600' }}>
            Recent Places
          </AppText>
          <View style={{ gap: 8 }}>
            {recentPlaces.map((place) => (
              <Pressable
                key={place.placeId || place.address}
                onPress={() => handleSelectDestination(place)}
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
                    {place.address}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}


      <AppButton
        title="Continue"
        variant="white"
        onPress={onContinue}
        disabled={!canContinueToVehicle}
      />
    </>
  );
}
