import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PassengerUser } from '../types/auth';
import { logout } from './authSlice';

export type PassengerProfileState = PassengerUser | null;

const initialState: PassengerProfileState = null;

const passengerProfileSlice = createSlice({
  name: 'passengerProfile',
  initialState,
  reducers: {
    setPassengerProfile: (_state, action: PayloadAction<PassengerUser>) => {
      return action.payload as any;
    },
    updatePassengerProfile: (state, action: PayloadAction<Partial<PassengerUser>>) => {
      if (state) {
        Object.assign(state, action.payload, { updatedAt: new Date().toISOString() });
      }
    },
    clearPassengerProfile: () => {
      return null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout.fulfilled, () => {
      return null;
    });
  },
});

export const { setPassengerProfile, updatePassengerProfile, clearPassengerProfile } = passengerProfileSlice.actions;
export const passengerProfileReducer = passengerProfileSlice.reducer;
