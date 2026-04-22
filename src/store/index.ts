import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  createTransform,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE
} from 'redux-persist';

import { AuthState, authReducer } from './authSlice';
import { driverLocationReducer } from './driverLocationSlice';
import { driverRideRequestReducer } from './driverRideRequestSlice';
import driverCurrentRideReducer from './driverCurrentRideSlice';
import { passengerLocationReducer } from './passengerLocationSlice';
import { rideReducer } from './rideSlice';
import toastReducer from './toastSlice';
import { driverProfileReducer } from './driverProfileSlice';
import { passengerProfileReducer } from './passengerProfileSlice';

const removeUndefinedDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, entry]) => {
        if (entry === undefined) {
          return acc;
        }

        acc[key] = removeUndefinedDeep(entry);
        return acc;
      },
      {}
    );
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }

  return value;
};

const sanitizePersistedStateTransform = createTransform(
  (inboundState) => removeUndefinedDeep(inboundState),
  (outboundState) => removeUndefinedDeep(outboundState)
);

const authStateTransform = createTransform<AuthState, AuthState>(
  (inboundState) => {
    const sanitizedState = removeUndefinedDeep(inboundState) as AuthState;
    const hasValidSessionId = Boolean(sanitizedState.session?.user?.id);

    return {
      ...sanitizedState,
      status: hasValidSessionId ? 'authenticated' : 'unauthenticated',
      session: hasValidSessionId ? sanitizedState.session : null,
      error: null
    };
  },
  (outboundState) => {
    const sanitizedState = removeUndefinedDeep(outboundState) as AuthState;
    const hasValidSessionId = Boolean(sanitizedState.session?.user?.id);

    return {
      ...sanitizedState,
      status: hasValidSessionId ? 'authenticated' : 'unauthenticated',
      session: hasValidSessionId ? sanitizedState.session : null,
      error: null
    };
  },
  { whitelist: ['auth'] }
);

const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  transforms: [sanitizePersistedStateTransform, authStateTransform],
  whitelist: ['activeRole', 'session', 'status']
};

const driverCurrentRidePersistConfig = {
  key: 'driverCurrentRide',
  storage: AsyncStorage,
  whitelist: ['currentRide']
};

const driverProfilePersistConfig = {
  key: 'driverProfile',
  storage: AsyncStorage,
  transforms: [sanitizePersistedStateTransform]
};

const passengerProfilePersistConfig = {
  key: 'passengerProfile',
  storage: AsyncStorage,
  transforms: [sanitizePersistedStateTransform]
};

const rootReducer = combineReducers({
  auth: persistReducer<AuthState>(authPersistConfig, authReducer),
  driverLocation: driverLocationReducer,
  driverRideRequest: driverRideRequestReducer,
  driverCurrentRide: persistReducer(driverCurrentRidePersistConfig, driverCurrentRideReducer),
  passengerLocation: passengerLocationReducer,
  ride: rideReducer,
  toast: toastReducer,
  driverProfile: persistReducer(driverProfilePersistConfig, driverProfileReducer),
  passengerProfile: persistReducer(passengerProfilePersistConfig, passengerProfileReducer),
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
      }
    })
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
