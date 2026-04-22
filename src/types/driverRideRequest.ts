export type DriverRideRequestStatus = 'accepted' | 'skipped' | 'expired';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type DriverRideRequest = {
  rideId: string;
  offerId: string;
  passengerId: string;
  pickupAddress: string;
  pickupCoordinates?: Coordinates;
  destinationAddress: string;
  destinationCoordinates?: Coordinates;
  paymentMethod: string;
  fare?: number;
  currency?: string;
  estimatedDistance?: string;
  estimatedDuration?: string;
  requestedAt: string;
  expiresAt: string;
};
