export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type RideStatus =
  | 'incoming_request'
  | 'accepted'
  | 'on_trip'
  | 'completed'
  | 'cancelled';

export type RouteSegment = {
  coordinates: Coordinate[];
  color: string;
  strokeWidth: number;
};

export type RouteData = {
  driverToPickup: Coordinate[];
  pickupToDestination: Coordinate[];
};

export type UberMapProps = {
  driverLocation: Coordinate;
  pickupLocation: Coordinate;
  destination: Coordinate;
  rideStatus: RideStatus;
  onRetry?: () => void;
  currentRideStatus?: string;
};

export type UseRouteOptions = {
  pickupLocation: Coordinate;
  destination: Coordinate;
  driverLocation: Coordinate;
  rideStatus: RideStatus;
};

export type UseRouteResult = {
  routeData: RouteData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export type MarkerConfig = {
  coordinate: Coordinate;
  type: 'driver' | 'pickup' | 'destination';
  label: string;
};
