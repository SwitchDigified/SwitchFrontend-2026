import { Coordinate } from './types';
import { GOOGLE_MAPS_DIRECTIONS_API_KEY } from '../../../config/api';

// ─── Lagos Dummy Coordinates (Idumisheri area) ────────────────────────────

export const DUMMY_DRIVER_LOCATION: Coordinate = {
  latitude: 6.55101,
  longitude: 3.24100,
};

export const DUMMY_PICKUP_LOCATION: Coordinate = {
  latitude: 6.54994,
  longitude: 3.24662,
};

export const DUMMY_DESTINATION: Coordinate = {
  latitude: 6.5346,
  longitude: 3.2398,
};

// ─── Route Colors ───────────────────────────────────────────────────────────

export const ROUTE_COLORS = {
  /** Driver → Pickup */
  driverToPickup: '#1C6EF2',
  /** Pickup → Destination */
  pickupToDestination: '#00C853',
  /** Active trip route */
  onTrip: '#00C853',
} as const;

export const ROUTE_STROKE_WIDTH = 6;
export const ROUTE_STROKE_WIDTH_DASHED = 6;

// ─── Map ────────────────────────────────────────────────────────────────────

export const MAP_PADDING = {
  top: 120,
  right: 60,
  bottom: 180,
  left: 60,
};

/** Google Directions API base URL — swap in your API key via env */
export const DIRECTIONS_API_BASE =
  'https://maps.googleapis.com/maps/api/directions/json';

/** Google Maps API Key from config */
export const GOOGLE_MAPS_API_KEY = GOOGLE_MAPS_DIRECTIONS_API_KEY;
