import React, { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { MapViewProps, PROVIDER_GOOGLE } from 'react-native-maps';

import { MAP_PADDING } from './constants';
import { MapMarkers } from './MapMarkers';
import { RoutePolylines } from './RoutePolylines';
import { Coordinate, RideStatus, UberMapProps } from './types';
import { useRoute } from './useRoute';
import { getBoundingRegion } from './utils';

// ─── Loading Overlay ─────────────────────────────────────────────────────

const MapLoadingOverlay: React.FC = () => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    return () => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    };
  }, [opacity]);

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color="#1C6EF2" />
        <Text style={styles.loadingText}>Calculating route…</Text>
      </View>
    </Animated.View>
  );
};

// ─── Error Overlay ────────────────────────────────────────────────────────

type MapErrorOverlayProps = {
  message: string;
  onRetry: () => void;
};

const MapErrorOverlay: React.FC<MapErrorOverlayProps> = ({
  message,
  onRetry,
}) => (
  <View style={styles.overlay} pointerEvents="box-none">
    <View style={styles.errorCard}>
      <Text style={styles.errorTitle}>Route Unavailable</Text>
      <Text style={styles.errorMessage} numberOfLines={2}>
        {message}
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.retryButton,
          pressed && styles.retryButtonPressed,
        ]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry fetching route"
      >
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  </View>
);

// ─── Main Component ───────────────────────────────────────────────────────

export const UberMap: React.FC<UberMapProps> = ({
  driverLocation,
  pickupLocation,
  destination,
  rideStatus,
  onRetry,
}) => {
  const mapRef = useRef<MapView>(null);
  const { routeData, loading, error, refetch } = useRoute({
    driverLocation,
    pickupLocation,
    destination,
    rideStatus,
  });

  /** Fit map camera to show all relevant markers */
  const fitMapToCoordinates = useCallback(
    (coords: Coordinate[]) => {
      if (!mapRef.current || coords.length === 0) return;

      mapRef.current.fitToCoordinates(
        coords.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
        {
          edgePadding: MAP_PADDING,
          animated: true,
        },
      );
    },
    [],
  );

  /** Re-fit camera whenever route data or status changes */
  useEffect(() => {
    if (loading || !routeData) return;

    const coordsToFit: Coordinate[] = [
      driverLocation,
      pickupLocation,
      destination,
    ];

    // Give the map a tick to finish rendering before animating
    const timer = setTimeout(() => fitMapToCoordinates(coordsToFit), 350);
    return () => clearTimeout(timer);
  }, [
    routeData,
    loading,
    rideStatus,
    driverLocation,
    pickupLocation,
    destination,
    fitMapToCoordinates,
  ]);

  const handleRetry = useCallback(() => {
    refetch();
    onRetry?.();
  }, [refetch, onRetry]);

  /** Compute initial region from all three coords */
  const initialRegion = getBoundingRegion(
    [driverLocation, pickupLocation, destination],
    0.25,
  );

  const mapProps: Partial<MapViewProps> = {
    ref: mapRef,
    style: styles.map,
    provider: PROVIDER_GOOGLE,
    showsUserLocation: false,
    showsMyLocationButton: false,
    showsCompass: false,
    showsTraffic: false,
    toolbarEnabled: false,
    pitchEnabled: false,
    rotateEnabled: false,
    moveOnMarkerPress: false,
    ...(initialRegion ? { initialRegion } : {}),
  };

  return (
    <View style={styles.container}>
      <MapView {...mapProps}>
        {/* Route lines */}
        {routeData && !loading && (
          <RoutePolylines routeData={routeData} rideStatus={rideStatus} />
        )}

        {/* Markers */}
        <MapMarkers
          driverLocation={driverLocation}
          pickupLocation={pickupLocation}
          destination={destination}
          rideStatus={rideStatus}
        />
      </MapView>

      {/* Loading */}
      {loading && <MapLoadingOverlay />}

      {/* Error */}
      {!loading && error && (
        <MapErrorOverlay message={error} onRetry={handleRetry} />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────

const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  android: { elevation: 8 },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Shared overlay wrapper
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 28,
  },

  // Loading card
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 40,
    ...CARD_SHADOW,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 0.2,
  },

  // Error card
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
    width: '85%',
    ...CARD_SHADOW,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  errorMessage: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 6,
    backgroundColor: '#1C6EF2',
    paddingHorizontal: 32,
    paddingVertical: 11,
    borderRadius: 24,
  },
  retryButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
