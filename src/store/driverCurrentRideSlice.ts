import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RideStatus } from '../types/ride';

/**
 * Ride location coordinates
 */
export type RideCoordinates = {
  latitude: number;
  longitude: number;
};

/**
 * Current active ride information displayed in bottom sheets
 * Tracks both ride request state and full ride lifecycle
 */


export type RideLocation = {
  address: string;
  coordinates: RideCoordinates;
  placeId: string;
};

export type DriverInfo = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhotoUrl: string;
  ratings: {
    count: number;
    average: number;
  };
};

export type RiderInfo = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhotoUrl: string | null;
  ratings: {
    count: number;
    average: number;
  };
};

export type RideMatching = {
  dispatchStatus: string;
  failureReason: string | null;
  offerId: string;
  selectedDriverId: string;
  updatedAt: string;
};

export type RideSchedule = {
  type: "now" | "scheduled";
};

export type DriverCurrentRide = {
  id: string;

  status: RideStatus;

  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;

  cancelBy?: string | null;

  passengerId: string;

  paymentMethod: string;

  price: string;

  rideType: string;

  maxSkipLimit: number;
  skipCount: number;

  pickupLocation: RideLocation;

  destinationLocation: RideLocation;

  stopLocation?: RideLocation | null;

  driver: DriverInfo;

  rider: RiderInfo;

  matching: RideMatching;

  schedule: RideSchedule;

  estimatedTimeRemaining?: string;

  estimatedDistance?: string;
};

/**
 * Driver Current Ride State
 * Tracks the active ride and manages bottom sheet visibility
 */
type DriverCurrentRideState = {
  currentRide: DriverCurrentRide | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: DriverCurrentRideState = {
  currentRide: null,
  isLoading: false,
  error: null,
};

const driverCurrentRideSlice = createSlice({
  name: 'driverCurrentRide',
  initialState,
  reducers: {
    /**
     * Set the current active ride
     */
    setCurrentRide(state, action: PayloadAction<DriverCurrentRide>) {
      console.log('Setting current ride in driverCurrentRideSlice:', action.payload);
      state.currentRide = action.payload;
      state.error = null;
    },

    /**
     * Update specific ride fields without replacing entire ride
     * Useful for updating status, ETA, or other live fields
     */
    updateCurrentRide(state, action: PayloadAction<Partial<DriverCurrentRide>>) {
      if (state.currentRide) {
        state.currentRide = { ...state.currentRide, ...action.payload };
      }
    },

    /**
     * Update ride status
     */
    updateRideStatus(state, action: PayloadAction<RideStatus>) {
      if (state.currentRide) {
        state.currentRide.status = action.payload;
      }
    },

    /**
     * Update estimated values for on_trip status
     */
    updateRideEstimates(
      state,
      action: PayloadAction<{
        estimatedTimeRemaining?: string;
        estimatedDistance?: string;
      }>
    ) {
      if (state.currentRide && state.currentRide.status === 'on_trip') {
        state.currentRide.estimatedTimeRemaining = action.payload.estimatedTimeRemaining;
        state.currentRide.estimatedDistance = action.payload.estimatedDistance;
      }
    },

    /**
     * Set loading state during operations
     */
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },

    /**
     * Set error message
     */
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },

    /**
     * Clear current ride (dismiss all sheets)
     */
    clearCurrentRide(state) {
      state.currentRide = null;
      state.error = null;
      state.isLoading = false;
    },

    /**
     * Reset to initial state
     */
    resetRideState() {
      return initialState;
    },
  },
});

export const {
  setCurrentRide,
  updateCurrentRide,
  updateRideStatus,
  updateRideEstimates,
  setLoading,
  setError,
  clearCurrentRide,
  resetRideState,
} = driverCurrentRideSlice.actions;

export default driverCurrentRideSlice.reducer;
