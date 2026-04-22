import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { Car, MapPin, Flag } from 'lucide-react-native';
import { Coordinate, RideStatus } from './types';

// ─── Individual Marker Pins ───────────────────────────────────────────────

const DriverPin: React.FC = () => (
  <View style={styles.driverMarker}>
    <View style={styles.driverMarkerPin}>
      <Car size={18} color="#fff" strokeWidth={2.5} />
    </View>
  </View>
);

const PickupPin: React.FC = () => (
  <View style={styles.pickupMarker}>
    <View style={styles.pickupMarkerPin}>
      <MapPin size={20} color="#fff" strokeWidth={2.5} />
    </View>
    <View style={styles.pickupMarkerTail} />
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
          tracksViewChanges={false}
        >
          {/* <DriverPin /> */}
        </Marker>
      )}

      {/* Pickup marker */}
      {showAll && (
        <Marker
          coordinate={pickupLocation}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
        >
          {/* <PickupPin /> */}
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
  // Driver marker - blue circular pin with car icon
  driverMarker: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 56,
    height: 56,
  },
  driverMarkerPin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1C6EF2',
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

  // Pickup marker - green pin with map pin icon
  pickupMarker: {
    alignItems: 'center',
    width: 56,
    height: 72,
  },
  pickupMarkerPin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00C853',
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
  pickupMarkerTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#00C853',
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 16,
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
