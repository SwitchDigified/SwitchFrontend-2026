export type RideType = 'single' | 'shared';
export type RideStatus =  'idle' | 'requested' | 'accepted' | 'arrived' | 'on_trip' | 'completed' | 'cancelled' | 'exhausted';
export type RideScheduleType = 'now' | 'later';
export type RideCancelledBy = 'passenger' | 'driver' | null;
export type RidePaymentMethod = 'cash' | 'card' | 'wallet' | (string & {});

export type RideCoordinates = {
  latitude: number;
  longitude: number;
};

export type RideLocation = {
  address: string;
  placeId?: string;
  coordinates: RideCoordinates;
};

export type RideSchedule = {
  type: RideScheduleType;
  pickupAt?: string;
};

export type RideParticipantRatings = {
  average: number;
  count: number;
};

type RideParticipantBase = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  profilePhotoUrl?: string | null;
  ratings?: RideParticipantRatings | null;
};

export type RideParticipantRider = RideParticipantBase;
export type RideParticipantDriver = RideParticipantBase;

export type RideMatchingData = {
  pickupLocation: RideLocation | null;
  stopLocation: RideLocation | null;
  destinationLocation: RideLocation | null;
  rideType: RideType;
  scheduleType: RideScheduleType;
  paymentMethod: RidePaymentMethod;
  cancelBy: RideCancelledBy;
  rider: RideParticipantRider;
  driver: RideParticipantDriver | null;
};

export type CreateRideRequestPayload = {
  passengerId: string;
  rideType: RideType;
  pickupLocation: RideLocation;
  stopLocation?: RideLocation;
  destinationLocation: RideLocation;
  paymentMethod: RidePaymentMethod;
  price?: string;
  rider: RideParticipantRider;
  driver: RideParticipantDriver | null;
  schedule: RideSchedule;
  currentRideStatus?: string | null;
};

export type RideRequest = {
  id: string;
  passengerId: string;
  rideType: RideType;
  status: RideStatus;
  cancelBy: RideCancelledBy;
  pickupLocation: RideLocation;
  stopLocation?: RideLocation;
  destinationLocation: RideLocation;
  paymentMethod: RidePaymentMethod;
  price?: string;
  rider: RideParticipantRider;
  driver: RideParticipantDriver | null;
  schedule: RideSchedule;
  createdAt: string;
  updatedAt: string;
};
