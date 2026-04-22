export type RideType = 'single' | 'shared';
export type RideStatus =  'idle' | 'requested' | 'accepted' | 'arrived' | 'on_trip' | 'completed' | 'cancelled';
export type RideScheduleType = 'now' | 'later';
export type RideCancelledBy = 'passenger' | 'driver' | null;

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

export type RideParticipantRider = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

export type RideParticipantDriver = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type RideMatchingData = {
  pickupLocation: RideLocation | null;
  stopLocation: RideLocation | null;
  destinationLocation: RideLocation | null;
  rideType: RideType;
  scheduleType: RideScheduleType;
  paymentMethod: string;
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
  paymentMethod: string;
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
  paymentMethod: string;
  rider: RideParticipantRider;
  driver: RideParticipantDriver | null;
  schedule: RideSchedule;
  createdAt: string;
  updatedAt: string;
};
