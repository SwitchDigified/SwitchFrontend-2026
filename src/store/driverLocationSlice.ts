import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LatLng } from 'react-native-maps';

export type DriverLiveLocation = LatLng & {
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  geohash: string;
  updatedAt: string;
};

export type DriverLocationState = {
  driverId: string | null;
  currentLocation: DriverLiveLocation | null;
  isOnline: boolean;
  isAvailable: boolean;
  activeRideId: string | null;
  isTracking: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  isSyncing: boolean;
};

const initialState: DriverLocationState = {
  driverId: null,
  currentLocation: null,
  isOnline: false,
  isAvailable: false,
  activeRideId: null,
  isTracking: false,
  error: null,
  lastSyncedAt: null,
  isSyncing: false
};

const driverLocationSlice = createSlice({
  name: 'driverLocation',
  initialState,
  reducers: {
    setDriverId: (state, action: PayloadAction<string>) => {
      state.driverId = action.payload;
    },
    setDriverOnlineState: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
      state.error = null;

      if (!action.payload) {
        state.isTracking = false;
        state.isAvailable = false;
      }
    },
    setDriverAvailableState: (state, action: PayloadAction<boolean>) => {
      state.isAvailable = action.payload;
    },
    setDriverActiveRide: (state, action: PayloadAction<string | null>) => {
      state.activeRideId = action.payload;
    },
    setDriverTrackingState: (state, action: PayloadAction<boolean>) => {
      state.isTracking = action.payload;
    },
    setDriverCurrentLocation: (state, action: PayloadAction<DriverLiveLocation>) => {
      state.currentLocation = action.payload;
      state.error = null;
    },
    setSyncingState: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    setLastSyncedAt: (state, action: PayloadAction<string>) => {
      state.lastSyncedAt = action.payload;
    },
    setDriverLocationError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    updateDriverLocationState: (
      state,
      action: PayloadAction<Partial<DriverLocationState>>
    ) => {
      return { ...state, ...action.payload };
    },
    resetDriverLocationState: () => initialState
  }
});

export const {
  setDriverId,
  setDriverOnlineState,
  setDriverAvailableState,
  setDriverActiveRide,
  setDriverTrackingState,
  setDriverCurrentLocation,
  setSyncingState,
  setLastSyncedAt,
  setDriverLocationError,
  updateDriverLocationState,
  resetDriverLocationState
} = driverLocationSlice.actions;

export const driverLocationReducer = driverLocationSlice.reducer;
