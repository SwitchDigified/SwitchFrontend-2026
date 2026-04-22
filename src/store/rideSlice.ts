import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { cancelRideRequestApi, createRideRequestApi } from '../api/rides';
import { updatePassengerRideState } from './authSlice';
import type {
  CreateRideRequestPayload,
  RideLocation,
  RideRequest,
  RideScheduleType,
  RideStatus,
  RideType,
} from '../types/ride';

type RideRequestStateStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export type RideState = {
  pickupLocation: RideLocation | null;
  stopLocation: RideLocation | null;
  destinationLocation: RideLocation | null;
  rideType: RideType;
  scheduleType: RideScheduleType;
  scheduledPickupAt: string | null;
  latestRide: RideRequest | null;
  requestStatus: RideRequestStateStatus;
  cancelStatus: RideRequestStateStatus;
  rideStatus: RideStatus | 'idle';
  error: string | null;
};

const initialState: RideState = {
  pickupLocation: null,
  stopLocation: null,
  destinationLocation: null,
  rideType: 'single',
  scheduleType: 'now',
  scheduledPickupAt: null,
  latestRide: null,
  requestStatus: 'idle',
  cancelStatus: 'idle',
  rideStatus: 'idle',
  error: null
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unable to create ride request right now.';
};

const sanitizeRideLocation = (location: RideLocation): RideLocation => {
  const sanitizedPlaceId =
    typeof location.placeId === 'string' && location.placeId.trim().length > 0
      ? location.placeId.trim()
      : undefined;

  return {
    address: location.address,
    ...(sanitizedPlaceId ? { placeId: sanitizedPlaceId } : {}),
    coordinates: location.coordinates
  };
};

export const createRideRequest = createAsyncThunk<
  RideRequest,
  { paymentMethod: string },
  {
    state: {
      auth: {
        session:
          | {
              user: {
                id: string;
                role: string;
                firstName: string;
                lastName: string;
                phone: string;
                email: string;
              };
            }
          | null;
      };
      ride: RideState;
    };
    rejectValue: string;
  }
>('ride/createRideRequest', async (arg, { getState, rejectWithValue, dispatch }) => {
  try {
    const state = getState();
    const sessionUser = state.auth.session?.user;

    if (!sessionUser || sessionUser.role !== 'passenger') {
      return rejectWithValue('Only an authenticated passenger can create a ride request');
    }

    const pickupLocation = state.ride.pickupLocation;
    const stopLocation = state.ride.stopLocation;
    const destinationLocation = state.ride.destinationLocation;

    if (!pickupLocation) {
      return rejectWithValue('Select your pickup location to continue');
    }

    if (!destinationLocation) {
      return rejectWithValue('Select your destination to continue');
    }

    const schedule: CreateRideRequestPayload['schedule'] =
      state.ride.scheduleType === 'later'
        ? {
            type: 'later',
            pickupAt:
              state.ride.scheduledPickupAt ??
              new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
        : {
            type: 'now'
          };

    const payload: CreateRideRequestPayload = {
      passengerId: sessionUser.id,
      rideType: state.ride.rideType,
      pickupLocation: sanitizeRideLocation(pickupLocation),
      stopLocation: stopLocation ? sanitizeRideLocation(stopLocation) : undefined,
      destinationLocation: sanitizeRideLocation(destinationLocation),
      paymentMethod: arg.paymentMethod,
      rider: {
        id: sessionUser.id,
        firstName: sessionUser.firstName,
        lastName: sessionUser.lastName,
        phone: sessionUser.phone,
        email: sessionUser.email
      },
      driver: null,
      schedule,
      currentRideStatus: state.ride.latestRide?.status ?? null
    };

    const ride = await createRideRequestApi(payload);

    dispatch(
      updatePassengerRideState({
        rideStatus: 'requested',
        activeRideId: ride.id
      })
    );

    return ride;
  } catch (error) {
    return rejectWithValue(toErrorMessage(error));
  }
});

export const cancelRideRequest = createAsyncThunk<
  RideRequest,
  void,
  {
    state: {
      auth: {
        session:
          | {
              user: {
                id: string;
                role: string;
              };
            }
          | null;
      };
      ride: RideState;
    };
    rejectValue: string;
  }
>('ride/cancelRideRequest', async (_, { getState, rejectWithValue, dispatch }) => {
  try {
    const state = getState();
    const sessionUser = state.auth.session?.user;
    const latestRide = state.ride.latestRide;

    if (!sessionUser || sessionUser.role !== 'passenger') {
      return rejectWithValue('Only an authenticated passenger can cancel a ride');
    }

    if (!latestRide?.id) {
      return rejectWithValue('No active ride found to cancel');
    }

    const ride = await cancelRideRequestApi({
      rideId: latestRide.id,
      passengerId: sessionUser.id,
    });

    dispatch(
      updatePassengerRideState({
        rideStatus: 'idle',
        activeRideId: null,
      })
    );

    return ride;
  } catch (error) {
    return rejectWithValue(toErrorMessage(error));
  }
});

const rideSlice = createSlice({
  name: 'ride',
  initialState,
  reducers: {
    setPickupLocation: (state, action: PayloadAction<RideLocation | null>) => {
      state.pickupLocation = action.payload;
      state.error = null;
    },
    setStopLocation: (state, action: PayloadAction<RideLocation | null>) => {
      state.stopLocation = action.payload;
      state.error = null;
    },
    setDestinationLocation: (state, action: PayloadAction<RideLocation | null>) => {
      state.destinationLocation = action.payload;
      state.error = null;
    },
    setRideType: (state, action: PayloadAction<RideType>) => {
      state.rideType = action.payload;
      state.error = null;
    },
    setScheduleType: (state, action: PayloadAction<RideScheduleType>) => {
      state.scheduleType = action.payload;
      if (action.payload === 'now') {
        state.scheduledPickupAt = null;
      }
      state.error = null;
    },
    setScheduledPickupAt: (state, action: PayloadAction<string | null>) => {
      state.scheduledPickupAt = action.payload;
      state.error = null;
    },
    clearRideError: (state) => {
      state.error = null;
    },
    resetRideDraft: (state) => {
      state.pickupLocation = null;
      state.stopLocation = null;
      state.destinationLocation = null;
      state.rideType = 'single';
      state.scheduleType = 'now';
      state.scheduledPickupAt = null;
      state.requestStatus = 'idle';
      state.cancelStatus = 'idle';
      state.rideStatus = 'idle';
      state.error = null;
    },
    setRide: (state, action: PayloadAction<RideRequest | null>) => {
      const ride = action.payload;
      if (ride) {
        // console.log('[Yes rideSlice] setRide action payload:',ride);
        state.pickupLocation = ride.pickupLocation;
        state.stopLocation = ride.stopLocation ?? null;
        state.destinationLocation = ride.destinationLocation;
        state.rideType = ride.rideType;
        state.scheduleType = ride.schedule.type;
        state.scheduledPickupAt = ride.schedule.pickupAt ?? null;
        state.latestRide = ride;
        state.rideStatus = ride.status;
      } else {
        state.pickupLocation = null;
        state.stopLocation = null;
        state.destinationLocation = null;
        state.scheduleType = 'now';
        state.scheduledPickupAt = null;
        state.latestRide = null;
        state.cancelStatus = 'idle';
        state.rideStatus = 'idle';
      }
      state.error = null;
      // console.log("current state after setRide reducer:", state);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(createRideRequest.pending, (state) => {
        state.requestStatus = 'loading';
        state.error = null;
      })
      .addCase(createRideRequest.fulfilled, (state, action) => {
        state.requestStatus = 'succeeded';
        state.rideStatus = action.payload.status;
        state.latestRide = action.payload;
        state.error = null;
      })
      .addCase(createRideRequest.rejected, (state, action) => {
        state.requestStatus = 'failed';
        state.error = action.payload ?? action.error.message ?? 'Unable to create ride request';
      })
      .addCase(cancelRideRequest.pending, (state) => {
        state.cancelStatus = 'loading';
        state.error = null;
      })
      .addCase(cancelRideRequest.fulfilled, (state, action) => {
        state.cancelStatus = 'succeeded';
        state.latestRide = action.payload;
        state.rideStatus = action.payload.status;
        state.error = null;
      })
      .addCase(cancelRideRequest.rejected, (state, action) => {
        state.cancelStatus = 'failed';
        state.error = action.payload ?? action.error.message ?? 'Unable to cancel ride request';
      });
  }
});

export const {
  setPickupLocation,
  setStopLocation,
  setDestinationLocation,
  setRideType,
  setScheduleType,
  setScheduledPickupAt,
  clearRideError,
  resetRideDraft,
  setRide
} = rideSlice.actions;

export const rideReducer = rideSlice.reducer;
