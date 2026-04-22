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
export type DriverCurrentRide = {
  id: string;
  status: RideStatus;
  passengerId: string;
  passengerName: string;
  passengerPhone?: string;
  pickupAddress: string;
  pickupCoordinates?: RideCoordinates;
  destinationAddress: string;
  destinationCoordinates?: RideCoordinates;
  paymentMethod?: string;
  estimatedPickupTime?: string; // For 'accepted' status
  estimatedTimeRemaining?: string; // For 'on_trip' status
  estimatedDistance?: string; // For 'on_trip' status
  tripDuration?: string; // For 'completed' status
  tripDistance?: string; // For 'completed' status
  fare?: number; // For 'completed' status
  currency?: string; // For 'completed' status
  createdAt?: string;
  updatedAt?: string;
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
