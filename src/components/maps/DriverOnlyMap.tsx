import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import DriverCarIcon from '../../assets/images/icons/passenger_home/car.svg';
import { DRIVER_MAP_STYLE } from '../../features/driver/constants/mapStyle';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface DriverOnlyMapProps {
  driverLocation: Coordinate;
  style?: any;
}

/**
 * DriverOnlyMap displays a map with only the driver marker
 * and automatically animates to the driver's current location.
 * Used when driver is online but has no active ride.
 */
export const DriverOnlyMap: React.FC<DriverOnlyMapProps> = ({
  driverLocation,
  style,
}) => {
  const mapRef = useRef<MapView>(null);

  // Build initial map region centered on driver location
  const initialRegion: Region = useMemo(() => {
    return {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [driverLocation]);

  // Animate to driver location when it updates
  useEffect(() => {
    if (mapRef.current && driverLocation) {
      mapRef.current.animateToRegion(
        {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        800 // Animation duration in ms
      );
    }
  }, [driverLocation]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      initialRegion={initialRegion}
      customMapStyle={DRIVER_MAP_STYLE}
      showsCompass={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      zoomControlEnabled={false}
    >
      {/* Driver Marker */}
      <Marker
        coordinate={driverLocation}
        title="Your Location"
        flat
        anchor={{ x: 0.5, y: 0.5 }}
      >
        {/* <View style={styles.driverMarkerContainer}>
          <DriverCarIcon width={32} height={32} color="#ffffff" />
        </View> */}
      </Marker>
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
    borderRadius: 0,
  },
  driverMarkerContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1de9b6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
});
