import React, { useEffect, useMemo, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import type { LatLng, MapStyleElement } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

// import type { RideLocation } from '../../../types/ride';
import { DRIVER_MAP_STYLE } from '../../features/driver/constants/mapStyle';
import DeliveryIcon from '../../assets/images/icons/passenger_home/user.svg';
import { RideLocation } from '../../types/ride';
import { GOOGLE_MAPS_DIRECTIONS_API_KEY } from '../../config/api';

export type PassengerMapProps = {
  mapRegion: Region;
  pickupLocation?: RideLocation | null;
  destinationLocation?: RideLocation | null;
  stopLocation?: RideLocation | null;
  googleMapsApiKey?: string;
  showPassengerPin?: boolean;
  showPolyline?: boolean;
  customMapStyle?: MapStyleElement[];
  style?: StyleProp<ViewStyle>;
  edgePadding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

const DEFAULT_EDGE_PADDING = {
  top: 100,
  right: 80,
  bottom: 200,
  left: 80,
};

const isValidCoordinate = (location: LatLng | null | undefined) =>
  Boolean(
    location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  );

export function PassengerMap({
  mapRegion,
  pickupLocation,
  destinationLocation,
  stopLocation,
  googleMapsApiKey = GOOGLE_MAPS_DIRECTIONS_API_KEY,
  showPassengerPin = true,
  showPolyline = false,
  customMapStyle = DRIVER_MAP_STYLE,
  style,
  edgePadding = DEFAULT_EDGE_PADDING,
}: PassengerMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (
      mapRef.current &&
      isValidCoordinate(pickupLocation?.coordinates) &&
      isValidCoordinate(destinationLocation?.coordinates)
    ) {
      mapRef.current.fitToCoordinates(
        [pickupLocation!.coordinates, destinationLocation!.coordinates],
        { edgePadding, animated: true }
      );
    }
  }, [pickupLocation, destinationLocation, edgePadding]);

  const showDirections = useMemo(() => {
    return (
      showPolyline &&
      isValidCoordinate(pickupLocation?.coordinates) &&
      isValidCoordinate(destinationLocation?.coordinates)
    );
  }, [showPolyline, pickupLocation, destinationLocation]);

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, style]}
      initialRegion={mapRegion}
      region={mapRegion}
      customMapStyle={customMapStyle}
      showsCompass={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
    >
      {showPassengerPin && (
        <Marker
          coordinate={mapRegion}
          title="You"
          flat
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.passengerPin} />
        </Marker>
      )}

      {pickupLocation ? (
        <Marker
          coordinate={pickupLocation.coordinates}
          title="Pickup"
          description={pickupLocation.address}
          flat
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={styles.pickupMarker}>
            <DeliveryIcon width={28} height={28} color="#ffffff" />
          </View>
        </Marker>
      ) : null}

      {stopLocation ? (
        <Marker
          coordinate={stopLocation.coordinates}
          title="Stop"
          description={stopLocation.address}
          flat
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={styles.stopMarker}>
            <DeliveryIcon width={28} height={28} color="#ffffff" />
          </View>
        </Marker>
      ) : null}

      {destinationLocation ? (
        <Marker
          coordinate={destinationLocation.coordinates}
          title="Destination"
          description={destinationLocation.address}
          flat
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={styles.destinationMarker}>
            <DeliveryIcon width={28} height={28} color="#ffffff" />
          </View>
        </Marker>
      ) : null}

      {showDirections ? (
        <MapViewDirections
          origin={pickupLocation!.coordinates}
          destination={destinationLocation!.coordinates}
          apikey={googleMapsApiKey}
          strokeWidth={3}
          strokeColor="#3b82f6"
          optimizeWaypoints={true}
          lineDashPattern={[0]}
        />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  passengerPin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pickupMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  stopMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  destinationMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
});