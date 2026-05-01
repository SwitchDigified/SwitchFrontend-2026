import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { Flag } from 'lucide-react-native';
import UserLocationIcon from '../../../assets/images/icons/passenger_home/user.svg';
import DriverLocationIcon from '../../../assets/images/icons/passenger_home/car.svg';
import { Coordinate, RideStatus } from './types';

// ─── Individual Marker Pins ───────────────────────────────────────────────

const DriverPin: React.FC = () => (
  <View collapsable={false} style={styles.driverMarker}>
    <DriverLocationIcon width={28} height={28} />
  </View>
);

const PickupPin: React.FC = () => (
  <View collapsable={false} style={styles.pickupMarker}>
    <UserLocationIcon width={28} height={28} />
  </View>
);

const DestinationPin: React.FC = () => (
  <View style={styles.destinationMarker}>
    <View style={styles.destinationMarkerPin}>
      <Flag size={20} color="#fff" strokeWidth={2.5} />
    </View>
    <View style={styles.destinationMarkerTail} />
  </View>
);

// ─── Props ────────────────────────────────────────────────────────────────

type MapMarkersProps = {
  driverLocation: Coordinate;
  pickupLocation: Coordinate;
  destination: Coordinate;
  rideStatus: RideStatus;
};

// ─── Component ───────────────────────────────────────────────────────────

export const MapMarkers: React.FC<MapMarkersProps> = ({
  driverLocation,
  pickupLocation,
  destination,
  rideStatus,
}) => {
  const showAll =
    rideStatus === 'incoming_request' ||
    rideStatus === 'accepted' ||
    rideStatus === 'on_trip';

  return (
    <>
      {/* Always show driver marker when ride is active */}
      {showAll && (
        <Marker
          coordinate={driverLocation}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges
          zIndex={13}
        >
          <DriverPin />
        </Marker>
      )}

      {/* Pickup marker */}
      {showAll && (
        <Marker
          coordinate={pickupLocation}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges
          zIndex={12}
        >
          <PickupPin />
        </Marker>
      )}

      {/* Destination marker */}
      {showAll && (
        <Marker
          coordinate={destination}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
        >
          {/* <DestinationPin /> */}
        </Marker>
      )}
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Driver marker - render car SVG directly (no extra circular wrapper)
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(15, 118, 110, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },

  // Pickup marker - green pin with map pin icon
  pickupMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 118, 110, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },

  // Destination marker - dark pin with flag icon
  destinationMarker: {
    alignItems: 'center',
    width: 56,
    height: 72,
  },
  destinationMarkerPin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1A2E',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  destinationMarkerTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1A1A2E',
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 16,
  },
});
