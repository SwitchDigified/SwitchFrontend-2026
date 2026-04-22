import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { Navigation } from 'lucide-react-native';
import { useAppSelector } from '../../store/hooks';
import type { RideStatus } from '../../types/ride';
import DriverCarIcon from '../../assets/images/icons/passenger_home/car.svg';
import UserLocationIcon from '../../assets/images/icons/passenger_home/user.svg';
import DestinationLocationIcon from '../../assets/images/icons/passenger_home/location.svg';
import { GOOGLE_MAPS_DIRECTIONS_API_KEY } from '../../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface PolylinePoint extends Coordinate {}

type RideRenderConfig = {
  showDriverMarker: boolean;
  showPickupMarker: boolean;
  showDestinationMarker: boolean;
  showDriverToPickupRoute: boolean;
  showPickupToDestinationRoute: boolean;
  pickupToDestinationColor: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = GOOGLE_MAPS_DIRECTIONS_API_KEY;

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: RideStatus;
  eta: number;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, eta }) => {
  const label: Record<RideStatus, string> = {
    idle: 'Ready for requests',
    requested: 'Ride request incoming',
    accepted: `Driver arriving in ${eta > 0 ? eta : '5'} min`,
    on_trip: 'On the way to destination',
    arrived: 'Driver has arrived',
    completed: 'Trip completed',
    cancelled: 'Ride cancelled',
  };

  const color: Record<RideStatus, string> = {
    idle: '#6B6B80',
    requested: '#FF9800',
    accepted: '#1A1A2E',
    on_trip: '#0047AB',
    arrived: '#0A7E5C',
    completed: '#2D2D2D',
    cancelled: '#C0392B',
  };

  return (
    <View style={[styles.statusBadge, { backgroundColor: color[status] }]}>
      <Navigation size={12} color="#FFFFFF" strokeWidth={2.5} />
      <Text style={styles.statusBadgeText}>{label[status]}</Text>
    </View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DriverRideMap: React.FC = () => {
  const mapRef = useRef<MapView>(null);

  // Get real ride data from Redux
  const currentRideRedux = useAppSelector((state) => state.driverCurrentRide.currentRide);
  const driverLocationRedux = useAppSelector((state) => state.driverLocation.currentLocation);

  const driverLocation = useMemo(
    () => driverLocationRedux,
    [driverLocationRedux]
  );

  const currentRide = useMemo(
    () => currentRideRedux,
    [currentRideRedux]
  );

  // Route polyline coordinates
  const [driverRoute, setDriverRoute] = useState<PolylinePoint[]>([]);
  const [tripRoute, setTripRoute] = useState<PolylinePoint[]>([]);
  const [eta, setEta] = useState<number>(0);

  // Get ride status or default
  const rideStatus = useMemo(
    () => (currentRide?.status || 'idle') as RideStatus,
    [currentRide?.status]
  );

  // ── Reset routes when status changes ────────────────────────────────────────
  // FIX: stale routes from a previous status were preventing re-draw
  useEffect(() => {
    setDriverRoute([]);
    setTripRoute([]);
  }, [rideStatus]);

  // ── Build initial map region ─────────────────────────────────────────────────
  const initialRegion: Region = useMemo(() => {
    const pickup = currentRide?.pickupCoordinates;
    const dest = currentRide?.destinationCoordinates;

    if (pickup && dest) {
      return {
        latitude: (pickup.latitude + dest.latitude) / 2,
        longitude: (pickup.longitude + dest.longitude) / 2,
        latitudeDelta: Math.abs(pickup.latitude - dest.latitude) * 2.5 + 0.02,
        longitudeDelta: Math.abs(pickup.longitude - dest.longitude) * 2.5 + 0.02,
      };
    }
    if (driverLocation) {
      return {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    // Default Lagos fallback
    return {
      latitude: 6.5244,
      longitude: 3.3792,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  }, [currentRide, driverLocation]);

  // ── Fit map after route is ready ─────────────────────────────────────────────
  const fitMap = useCallback(() => {
    if (!mapRef.current) return;

    const coords: Coordinate[] = [];
    if (driverLocation) coords.push(driverLocation);
    if (currentRide?.pickupCoordinates) coords.push(currentRide.pickupCoordinates);
    if (currentRide?.destinationCoordinates) coords.push(currentRide.destinationCoordinates);

    if (coords.length < 2) return;

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 100, right: 50, bottom: 420, left: 50 },
      animated: true,
    });
  }, [driverLocation, currentRide]);

  // ── Fit map when on_trip ─────────────────────────────────────────────────────
  useEffect(() => {
    if (rideStatus === 'on_trip' || rideStatus === 'accepted') {
      setTimeout(fitMap, 500); // small delay to let route render first
    }
  }, [rideStatus, fitMap]);

  const rideRenderConfig = useMemo<RideRenderConfig>(() => {
    switch (rideStatus) {
      case 'accepted':
        return {
          showDriverMarker: true,
          showPickupMarker: true,
          showDestinationMarker: true,
          showDriverToPickupRoute: true,
          showPickupToDestinationRoute: true,
          pickupToDestinationColor: '#F59E0B',
        };
      case 'on_trip':
        return {
          showDriverMarker: true,
          showPickupMarker: true,
          showDestinationMarker: true,
          showDriverToPickupRoute: false,
          showPickupToDestinationRoute: true,
          pickupToDestinationColor: '#0047AB',
        };
      case 'arrived':
        return {
          showDriverMarker: true,
          showPickupMarker: true,
          showDestinationMarker: true,
          showDriverToPickupRoute: false,
          showPickupToDestinationRoute: true,
          pickupToDestinationColor: '#0047AB',
        };
      default:
        return {
          showDriverMarker: false,
          showPickupMarker: false,
          showDestinationMarker: false,
          showDriverToPickupRoute: false,
          showPickupToDestinationRoute: false,
          pickupToDestinationColor: '#0047AB',
        };
    }
  }, [rideStatus]);

  // Determine which origin/destination to use for each route
  const driverToPickupOrigin = driverLocation ?? undefined;
  const driverToPickupDestination = currentRide?.pickupCoordinates ?? undefined;
  const pickupToDestinationOrigin = currentRide?.pickupCoordinates ?? undefined;
  const pickupToDestinationDestination = currentRide?.destinationCoordinates ?? undefined;

  const showDriverToPickupRoute =
    rideRenderConfig.showDriverToPickupRoute &&
    !!driverToPickupOrigin &&
    !!driverToPickupDestination;
  const showPickupToDestinationRoute =
    rideRenderConfig.showPickupToDestinationRoute &&
    !!pickupToDestinationOrigin &&
    !!pickupToDestinationDestination;



  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onMapReady={fitMap}
        showsUserLocation={false}
        showsCompass={false}
        showsTraffic={false}
        customMapStyle={MAP_STYLE}
        rotateEnabled
        pitchEnabled={false}
        moveOnMarkerPress={false}
      >
        {/* ── Route: Driver → Pickup (accepted) ── */}
        {showDriverToPickupRoute && (
          <MapViewDirections
            origin={driverToPickupOrigin!}
            destination={driverToPickupDestination!}
            apikey={GOOGLE_MAPS_API_KEY}
            // FIX: strokeWidth MUST be > 0 for onReady to fire reliably on all
            // react-native-maps-directions versions. We hide it by matching map bg.
            // Actual styled Polyline is drawn below from the returned coordinates.
            strokeWidth={1}
            strokeColor="transparent"
            mode="DRIVING"
            precision="high"
            timePrecision="now"
            onReady={(result) => {
              console.log('[DriverRoute] coords:', result.coordinates.length, 'duration:', result.duration);
              setDriverRoute(result.coordinates);
              setEta(Math.ceil(result.duration));
              // Fit map once we have the real route
              setTimeout(() => {
                mapRef.current?.fitToCoordinates(result.coordinates, {
                  edgePadding: { top: 100, right: 50, bottom: 420, left: 50 },
                  animated: true,
                });
              }, 300);
            }}
            onError={(error) => {
              console.error('[DriverRoute] error:', error);
            }}
          />
        )}

        {/* ── Route: Pickup → Destination (on_trip / arrived) ── */}
        {showPickupToDestinationRoute && (
          <MapViewDirections
            origin={pickupToDestinationOrigin!}
            destination={pickupToDestinationDestination!}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={1}
            strokeColor="transparent"
            mode="DRIVING"
            precision="high"
            timePrecision="now"
            onReady={(result) => {
              console.log('[TripRoute] coords:', result.coordinates.length, 'duration:', result.duration);
              setTripRoute(result.coordinates);
              setTimeout(() => {
                mapRef.current?.fitToCoordinates(result.coordinates, {
                  edgePadding: { top: 100, right: 50, bottom: 420, left: 50 },
                  animated: true,
                });
              }, 300);
            }}
            onError={(error) => {
              console.error('[TripRoute] error:', error);
            }}
          />
        )}

        {/* ── Polyline: Driver → Pickup (white solid style) ── */}
        {showDriverToPickupRoute && driverRoute.length > 1 && (
          <Polyline
            coordinates={driverRoute}
            strokeColor="#FFFFFF"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        )}

        {/* ── Polyline: Pickup → Destination (solid blue) ── */}
        {showPickupToDestinationRoute && tripRoute.length > 1 && (
          <Polyline
            coordinates={tripRoute}
            strokeColor={rideRenderConfig.pickupToDestinationColor}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        )}

        {/* ── Marker: Driver (custom car SVG) ── */}
        {driverLocation && rideRenderConfig.showDriverMarker && (
          <Marker
            coordinate={driverLocation}
            title="You"
            description="Your current location"
            zIndex={10}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            {/* <View style={styles.driverMarker}>
              <DriverCarIcon width={26} height={26} />
            </View> */}
          </Marker>
        )}

        {/* ── Marker: Pickup (custom user SVG) ── */}
        {currentRide?.pickupCoordinates && rideRenderConfig.showPickupMarker && (
          <Marker
            coordinate={currentRide.pickupCoordinates}
            title="Pickup"
            description={currentRide.pickupAddress}
            zIndex={9}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            {/* <View style={styles.pickupMarker}>
              <UserLocationIcon width={24} height={24} />
            </View> */}
          </Marker>
        )}

        {/* ── Marker: Destination (custom location SVG) ── */}
        {rideRenderConfig.showDestinationMarker && currentRide?.destinationCoordinates && (
          <Marker
            coordinate={currentRide.destinationCoordinates}
            title="Destination"
            description={currentRide.destinationAddress}
            zIndex={9}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            {/* <View style={styles.destinationMarker}>
              <DestinationLocationIcon width={24} height={24} />
            </View> */}
          </Marker>
        )}
      </MapView>

      {/* ── Status Badge ── */}
      <View style={styles.statusBadgeContainer}>
        <StatusBadge status={rideStatus} eta={eta} />
      </View>

      {/* ── Recenter Button ── */}
      <TouchableOpacity style={styles.recenterBtn} onPress={fitMap} activeOpacity={0.8}>
        <Navigation size={18} color="#1A1A2E" strokeWidth={2} />
      </TouchableOpacity>


    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F8' },
  map: { ...StyleSheet.absoluteFillObject },

  // Custom markers
  driverMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(3, 37, 65, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pickupMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
  destinationMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(127, 29, 29, 0.95)',
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
  routeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  // Status badge
  statusBadgeContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    alignSelf: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Recenter button
  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: 490,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: { alignItems: 'center', paddingVertical: 12 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E8' },

  // Driver Row
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  ratingPill: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    transform: [{ translateX: -18 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#F0F0F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  ratingText: { fontSize: 10, fontWeight: '700', color: '#1A1A2E' },
  driverInfo: { flex: 1, gap: 2 },
  driverName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', letterSpacing: 0.1 },
  driverVehicle: { fontSize: 13, color: '#6B6B80', fontWeight: '400' },
  platePill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#F2F2F8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  plateText: { fontSize: 12, fontWeight: '700', color: '#1A1A2E', letterSpacing: 1.2 },
  contactBtns: { gap: 8 },
  contactBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Divider
  divider: { height: 1, backgroundColor: '#F0F0F6', marginHorizontal: 20 },

  // Trip Info
  tripInfo: { paddingHorizontal: 20, paddingVertical: 14, gap: 0 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  tripConnector: {
    width: 1.5,
    height: 14,
    backgroundColor: '#E0E0E8',
    marginLeft: 4.25,
    marginVertical: 4,
  },
  tripTextCol: { flex: 1 },
  tripLabel: { fontSize: 10, fontWeight: '700', color: '#9A9AB0', letterSpacing: 1, marginBottom: 1 },
  tripAddress: { fontSize: 13, fontWeight: '500', color: '#1A1A2E' },

  // Fare Row
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  fareItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  fareLabel: { fontSize: 13, color: '#6B6B80', fontWeight: '400' },
  farePricePill: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  farePriceText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  // Expanded content
  expandedContent: { maxHeight: 200 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F2F2F8',
    flexBasis: (SCREEN_WIDTH - 52) / 2,
  },
  actionBtnDanger: { backgroundColor: '#FFF0EE' },
  actionBtnLabel: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  actionBtnLabelDanger: { color: '#C0392B' },

  // Expand row
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  expandLabel: { fontSize: 12, color: '#9A9AB0', fontWeight: '500' },
});

// ─── Google Maps Custom Style (Dark Theme) ────────────────────────────────────

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9E9EAE' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#b0b0b0' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9E9EAE' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2d4a3d' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#9E9EAE' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d2d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a0a0a0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d3d' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#c0c0c0' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2d2d2d' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#9E9EAE' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a2a3a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6b8cae' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
];

export default DriverRideMap;
