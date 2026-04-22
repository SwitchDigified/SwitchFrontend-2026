import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DriverUser } from '../types/auth';
import { logout } from './authSlice';

export type DriverProfileState = DriverUser | null;

const initialState: DriverProfileState = null;

const driverProfileSlice = createSlice({
  name: 'driverProfile',
  initialState,
  reducers: {
    setDriverProfile: (_state, action: PayloadAction<DriverUser>) => {
      return action.payload as any;
    },
    updateDriverProfile: (state, action: PayloadAction<Partial<DriverUser>>) => {
      if (state) {
        Object.assign(state, action.payload, { updatedAt: new Date().toISOString() });
      }
    },
    clearDriverProfile: () => {
      return null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout.fulfilled, () => {
      return null;
    });
  },
});

export const { setDriverProfile, updateDriverProfile, clearDriverProfile } = driverProfileSlice.actions;
export const driverProfileReducer = driverProfileSlice.reducer;
