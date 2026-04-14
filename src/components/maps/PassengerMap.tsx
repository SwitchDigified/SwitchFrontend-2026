import React, { useEffect, useMemo, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import type { LatLng, MapStyleElement } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

import type { RideLocation } from '../../../types/ride';
import { DRIVER_MAP_STYLE } from '../../features/driver/constants/mapStyle';

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
  googleMapsApiKey = 'AIzaSyBWM3mSjwH0AGvePtRzsemxzUPAMZlHOUQ',
  showPassengerPin = true,
  showPolyline = false,
  customMapStyle = DRIVER_MAP_STYLE,
  style,
  edgePadding = DEFAULT_EDGE_PADDING,
}: PassengerMapProps) {
  const mapRef = useRef<MapView>(null);

  // Auto-fit map to show all markers when both pickup and destination are available
  useEffect(() => {
    if (
      mapRef.current &&
      isValidCoordinate(pickupLocation?.coordinates) &&
      isValidCoordinate(destinationLocation?.coordinates)
    ) {
      mapRef.current.fitToCoordinates(
        [
          pickupLocation!.coordinates,
          destinationLocation!.coordinates,
        ],
        {
          edgePadding,
          animated: true,
        }
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
      {/* Passenger current location pin (at center) */}
      {showPassengerPin && (
        <Marker
          coordinate={mapRegion}
          title="You"
          pinColor="#3b82f6"
          flat
        >
          <View style={styles.passengerPin} />
        </Marker>
      )}

      {/* Pickup location marker */}
      {pickupLocation ? (
        <Marker
          coordinate={pickupLocation.coordinates}
          title="Pickup"
          description={pickupLocation.address}
          pinColor="#22c55e"
        />
      ) : null}

      {/* Stop location marker */}
      {stopLocation ? (
        <Marker
          coordinate={stopLocation.coordinates}
          title="Stop"
          description={stopLocation.address}
          pinColor="#38bdf8"
        />
      ) : null}

      {/* Destination location marker */}
      {destinationLocation ? (
        <Marker
          coordinate={destinationLocation.coordinates}
          title="Destination"
          description={destinationLocation.address}
          pinColor="#f59e0b"
        />
      ) : null}

      {/* Polyline/Directions from pickup to destination */}
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
});
