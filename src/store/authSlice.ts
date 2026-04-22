import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ZodError } from 'zod';
import { signInWithCustomToken, getAuth } from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import { authApi, firestoreApi } from '../api/apiClient';
import {
  AuthSession,
  DriverProfileUpdatePayload,
  LoginPayload,
  LoginResponseData,
  PassengerRideStatus,
  PassengerUser,
  RegisterPayloadByRole,
  UserRole,
  AppUser
} from '../types/auth';
import { RideStatus } from '../types/ride';
import { setDriverProfile } from './driverProfileSlice';
import { setPassengerProfile } from './passengerProfileSlice';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export type AuthState = {
  status: AuthStatus;
  activeRole: UserRole;
  session: AuthSession | null;
  error: string | null;
};

const initialState: AuthState = {
  status: 'unauthenticated',
  activeRole: 'passenger',
  session: null,
  error: null
};

type StructuredValidationIssue = {
  path?: unknown;
  message?: unknown;
};

const formatValidationIssue = (issue: StructuredValidationIssue): string | null => {
  if (typeof issue.message !== 'string' || issue.message.trim().length === 0) {
    return null;
  }

  if (!Array.isArray(issue.path) || issue.path.length === 0) {
    return issue.message.trim();
  }

  const safePath = issue.path
    .filter((segment) => typeof segment === 'string' || typeof segment === 'number')
    .map((segment) => String(segment))
    .join('.');

  if (!safePath) {
    return issue.message.trim();
  }

  return `${safePath}: ${issue.message.trim()}`;
};

const tryParseStructuredErrorMessage = (message: string): string | null => {
  const trimmed = message.trim();
  if (!trimmed || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (Array.isArray(parsed) && parsed.length > 0) {
      const firstIssue = parsed[0] as StructuredValidationIssue;
      return formatValidationIssue(firstIssue);
    }

    if (parsed && typeof parsed === 'object') {
      const withMessage = parsed as { message?: unknown };
      if (typeof withMessage.message === 'string' && withMessage.message.trim().length > 0) {
        return withMessage.message.trim();
      }
    }
  } catch {
    return null;
  }

  return null;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof ZodError && error.issues.length > 0) {
    const firstIssue = error.issues[0];
    return formatValidationIssue({
      path: firstIssue.path,
      message: firstIssue.message
    }) ?? 'Validation failed. Please check your details and try again.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return tryParseStructuredErrorMessage(error.message) ?? error.message;
  }

  if (typeof error === 'string') {
    return tryParseStructuredErrorMessage(error) ?? error;
  }

  return 'Something went wrong. Please try again.';
};

const getAuthCodeFromMessage = (message: string): string | null => {
  const match = message.match(/\[(auth\/[a-z-]+)\]/i);
  return match?.[1]?.toLowerCase() ?? null;
};

const toLoginErrorMessage = (error: unknown): string => {
  const fallbackMessage = 'Unable to login right now. Please try again.';

  if (error instanceof Error && error.message.trim().length > 0) {
    const code = getAuthCodeFromMessage(error.message);

    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-email':
        return 'Invalid email or password';
      case 'auth/too-many-requests':
        return 'Too many login attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      default:
        return toErrorMessage(error) || fallbackMessage;
    }
  }

  if (typeof error === 'string') {
    const code = getAuthCodeFromMessage(error);
    if (
      code === 'auth/user-not-found' ||
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-email'
    ) {
      return 'Invalid email or password';
    }
  }

  return toErrorMessage(error) || fallbackMessage;
};

type RegisterAndLoginInput =
  | { role: 'passenger'; payload: RegisterPayloadByRole['passenger'] }
  | { role: 'driver'; payload: RegisterPayloadByRole['driver'] };

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asFiniteNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asLocation = (value: unknown): { lat: number; lng: number } | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const maybeLocation = value as { lat?: unknown; lng?: unknown };
  const lat = typeof maybeLocation.lat === 'number' ? maybeLocation.lat : NaN;
  const lng = typeof maybeLocation.lng === 'number' ? maybeLocation.lng : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }

  return { lat, lng };
};

const resolveUserId = (user: Record<string, unknown>, fallbackUserId?: string): string => {
  const candidates = [user.id, user.uid, user.userId, user._id, fallbackUserId];

  for (const candidate of candidates) {
    const id = asNonEmptyString(candidate);
    if (id) {
      return id;
    }
  }

  throw new Error('Authenticated user id is missing from login response');
};

const toIsoTimestamp = (value: unknown): string => asNonEmptyString(value) ?? new Date().toISOString();

const normalizePassengerRideStatus = (rideStatus: string | null | undefined): PassengerRideStatus => {
  if (!rideStatus) return 'idle';

  switch (rideStatus.trim().toLowerCase()) {
    case 'requested':
    case 'requesting':
    case 'searching_driver':
      return 'requested';
    case 'accepted':
      return 'accepted';
    case 'arrived':
      return 'arrived';
    case 'on_trip':
    case 'on_ride':
      return 'on_trip';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'idle';
  }
};

const normalizeUser = (user: LoginResponseData['user'] | AuthSession['user']): AuthSession['user'] => {
  if (user.role !== 'driver') {
    return {
      ...user,
      rideStatus: normalizePassengerRideStatus(user.rideStatus),
      activeRideId: user.activeRideId ?? null
    };
  }

  return {
    ...user,
    basicProfile: user.basicProfile ?? null,
    vehicleDetails: user.vehicleDetails ?? null,
    preference: user.preference ?? null,
    ratingAverage: user.ratingAverage ?? 0,
    ratingCount: user.ratingCount ?? 0,
    completedTrips: user.completedTrips ?? 0
  };
};

// Convert authService ride status to the app's PassengerRideStatus type
const convertRideStatus = (status: unknown): PassengerRideStatus => {
  // The authService uses a broader set of statuses from the backend
  // Normalize them to the app's canonical types
  const normalized = normalizePassengerRideStatus(asNonEmptyString(status));
  // Now convert to the app's RideStatus or 'idle'
  if (normalized === 'idle') return 'idle';
  return normalized as RideStatus;
};

// Convert server response user to the app's AuthApiUser type
const convertToAuthApiUser = (
  user: Record<string, unknown>,
  fallbackUserId?: string
): LoginResponseData['user'] => {
  const role = user.role === 'driver' ? 'driver' : 'passenger';
  const id = resolveUserId(user, fallbackUserId);
  const lastKnownLocation = asLocation(user.lastKnownLocation);
  const lastLocationUpdatedAt = asNonEmptyString(user.lastLocationUpdatedAt);

  const baseUser = {
    id,
    role: role as UserRole,
    firstName: asNonEmptyString(user.firstName) ?? '',
    lastName: asNonEmptyString(user.lastName) ?? '',
    email: asNonEmptyString(user.email) ?? '',
    phone: asNonEmptyString(user.phone) ?? '',
    fcmToken: asNonEmptyString(user.fcmToken) ?? '',
    ...(lastKnownLocation ? { lastKnownLocation } : {}),
    ...(lastLocationUpdatedAt ? { lastLocationUpdatedAt } : {}),
    termsAccepted: true as const,
    createdAt: toIsoTimestamp(user.createdAt),
    updatedAt: toIsoTimestamp(user.updatedAt),
  };

  if (role === 'passenger') {
    const dateOfBirth = asNonEmptyString(user.dateOfBirth);

    return {
      ...baseUser,
      role: 'passenger' as const,
      ...(dateOfBirth ? { dateOfBirth } : {}),
      walletBalance: asFiniteNumber(user.walletBalance, 0),
      switchCoinBalance: asFiniteNumber(user.switchCoinBalance, 0),
      rideStatus: convertRideStatus(user.rideStatus),
      activeRideId: asNonEmptyString(user.activeRideId) ?? null,
    };
  } else {
    return {
      ...baseUser,
      role: 'driver' as const,
      basicProfile: (user.basicProfile as any) ?? null,
      vehicleDetails: (user.vehicleDetails as any) ?? null,
      preference: (user.preference as any) ?? null,
      ratingAverage: asFiniteNumber(user.ratingAverage, 0),
      ratingCount: asFiniteNumber(user.ratingCount, 0),
      completedTrips: asFiniteNumber(user.completedTrips, 0),
    };
  }
};

const buildSession = (input: {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: Record<string, unknown>;
  userIdFallback?: string;
}) => {
  const expiresInSeconds = Number(input.expiresIn);
  const safeDurationInSeconds = Number.isFinite(expiresInSeconds)
    ? Math.max(expiresInSeconds, 60)
    : 3600;

  return {
    token: input.token,
    refreshToken: input.refreshToken,
    expiresAt: Date.now() + safeDurationInSeconds * 1000,
    user: normalizeUser(convertToAuthApiUser(input.user, input.userIdFallback))
  } satisfies AuthSession;
};

const syncUserFcmToken = async (input: {
  role: UserRole;
  userId: string;
  currentToken: string;
}): Promise<{ fcmToken: string; updatedAt: string } | null> => {
  await messaging().requestPermission().catch(() => undefined);
  await messaging().registerDeviceForRemoteMessages().catch(() => undefined);

  const nextToken = (await messaging().getToken()).trim();
  if (!nextToken) {
    return null;
  }

  if (nextToken === input.currentToken) {
    return {
      fcmToken: nextToken,
      updatedAt: new Date().toISOString()
    };
  }

  const updatedAt = new Date().toISOString();
  await firestoreApi.mergeUserFcmToken(input.role, input.userId, {
    fcmToken: nextToken,
    updatedAt
  });

  return {
    fcmToken: nextToken,
    updatedAt
  };
};

const signInToFirebaseWithCustomToken = async (token: string): Promise<string> => {
  const auth = getAuth();
  const credential = await signInWithCustomToken(auth, token);
  const firebaseUid = credential.user?.uid;

  if (!firebaseUid) {
    throw new Error('Firebase login succeeded without a user id');
  }

  return firebaseUid;
};

export const login = createAsyncThunk<AuthSession, LoginPayload, { rejectValue: string; dispatch: any }>(
  'auth/login',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      console.log('[authSlice] login:req', { email: payload.email });

      // Call server auth endpoint with timeout
      const response = await authApi.login(payload.email, payload.password);

      console.log('[authSlice] login:success', response.data);

      // Sign in to Firebase with custom token first so auth survives app reload.
      const firebaseUid = await signInToFirebaseWithCustomToken(response.data.token);

      // Build session from server response
      const session = buildSession({
        ...response.data,
        userIdFallback: firebaseUid
      });

      const fcmTokenSync = await syncUserFcmToken({
        role: session.user.role,
        userId: session.user.id,
        currentToken: session.user.fcmToken
      }).catch((error) => {
        console.log('[authSlice] login:fcm-sync-error', {
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
      });

      const sessionWithToken: AuthSession = fcmTokenSync
        ? {
            ...session,
            user: {
              ...session.user,
              fcmToken: fcmTokenSync.fcmToken,
              updatedAt: fcmTokenSync.updatedAt
            }
          }
        : session;

    

      // Dispatch profile data based on user role
      if (sessionWithToken.user.role === 'driver') {
        console.log('[authSlice] login:setting-driver-profile',sessionWithToken);
        dispatch(setDriverProfile(sessionWithToken.user as any));
      } else {
        console.log('[authSlice] login:setting-passenger-profile',sessionWithToken);
        dispatch(setPassengerProfile(sessionWithToken.user as any));
      }

      return sessionWithToken;
    } catch (error) {
      console.log('[authSlice] login:error', {
        email: payload.email,
        message: toLoginErrorMessage(error),
      });
      return rejectWithValue(toLoginErrorMessage(error));
    }
  }
);

export const registerAndLogin = createAsyncThunk<
  AuthSession,
  RegisterAndLoginInput,
  { rejectValue: string; dispatch: any }
>('auth/registerAndLogin', async ({ role, payload }, { rejectWithValue, dispatch }) => {
  try {
    console.log('[authSlice] registerAndLogin:req', {
      role,
      email: payload.email,
    });

    // Call server auth endpoint with timeout
    let response;
    if (role === 'passenger') {
      response = await authApi.registerPassenger(payload);
    } else {
      response = await authApi.registerDriver(payload);
    }

    console.log('[authSlice] registerAndLogin:registration-success', {
      role,
      email: payload.email,
      userId: response.data.user.id ?? null,
    });

    // Sign in to Firebase with custom token to establish a persistent auth session.
    const firebaseUid = await signInToFirebaseWithCustomToken(response.data.token);
    console.log('[authSlice] Firebase sign-in with custom token succeeded', { uid: firebaseUid });

    // Build session from server response (registration already includes user data)
    const session = buildSession({
      ...response.data,
      userIdFallback: firebaseUid
    });

    const fcmTokenSync = await syncUserFcmToken({
      role: session.user.role,
      userId: session.user.id,
      currentToken: session.user.fcmToken
    }).catch((error) => {
      console.log('[authSlice] registerAndLogin:fcm-sync-error', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    });

    const sessionWithToken: AuthSession = fcmTokenSync
      ? {
          ...session,
          user: {
            ...session.user,
            fcmToken: fcmTokenSync.fcmToken,
            updatedAt: fcmTokenSync.updatedAt
          }
        }
      : session;

    // Dispatch profile data based on user role
    if (role === 'driver') {
      dispatch(setDriverProfile(sessionWithToken.user as any));
    } else {
      dispatch(setPassengerProfile(sessionWithToken.user as any));
    }

    return sessionWithToken;
  } catch (error) {
    console.log('[authSlice] registerAndLogin:error', {
      role,
      message: toErrorMessage(error),
    });
    return rejectWithValue(toErrorMessage(error));
  }
});

export const logout = createAsyncThunk<void, void, { dispatch: any }>(
  'auth/logout',
  async (_, { dispatch }) => {
    // Logout is handled client-side through Redux state clearing
    // No server-side logout needed for stateless auth
    return undefined;
  }
);

export const restoreSession = createAsyncThunk<
  AuthSession | null,
  void,
  { state: { auth: AuthState }; rejectValue: string }
>(
  'auth/restoreSession',
  async (_, { getState, rejectWithValue }) => {
    try {
      const persistedSession = getState().auth.session;

      if (!persistedSession?.user?.id) {
        return null;
      }

      return {
        ...persistedSession,
        user: normalizeUser(persistedSession.user)
      };
    } catch (error) {
      return rejectWithValue(toErrorMessage(error));
    }
  }
);

export const updateDriverProfile = createAsyncThunk<
  AuthSession['user'],
  DriverProfileUpdatePayload,
  { state: { auth: AuthState }; rejectValue: string }
>('auth/updateDriverProfile', async (payload, { getState, rejectWithValue }) => {
  try {
    const session = getState().auth.session;

    if (!session || session.user.role !== 'driver') {
      return rejectWithValue('Only an authenticated driver can update profile data');
    }

    // Call server to update driver profile
    await firestoreApi.mergeDriverProfile(session.user.id, payload);

    // Return updated user object
    const updatedUser = {
      ...session.user,
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    return normalizeUser(updatedUser as any);
  } catch (error) {
    return rejectWithValue(toErrorMessage(error));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setActiveRole: (state, action: PayloadAction<UserRole>) => {
      state.activeRole = action.payload;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
    clearSessionState: (state) => {
      state.status = 'unauthenticated';
      state.session = null;
      state.error = null;
    },
    hydrateAuthStatus: (state) => {
      state.status = state.session ? 'authenticated' : 'unauthenticated';
      state.error = null;
    },
    rebuildSessionFromProfile: (state, action: PayloadAction<AppUser>) => {
      // Rebuild session from persisted profile data (used after app reload)
      state.status = 'authenticated';
      state.session = {
        token: '', // Token is not persisted, will be fetched on next API call
        refreshToken: '',
        expiresAt: Date.now() + 3600 * 1000, // Assume fresh session
        user: normalizeUser(action.payload),
      };
      state.activeRole = action.payload.role;
      state.error = null;
    },
    updatePassengerRideState: (
      state,
      action: PayloadAction<{ rideStatus: PassengerRideStatus; activeRideId: string | null }>
    ) => {
      if (!state.session || state.session.user.role !== 'passenger') {
        return;
      }

      state.session.user.rideStatus = action.payload.rideStatus;
      state.session.user.activeRideId = action.payload.activeRideId;
    },
    updateSessionFcmToken: (
      state,
      action: PayloadAction<{ fcmToken: string; updatedAt: string }>
    ) => {
      if (!state.session) {
        return;
      }

      state.session.user.fcmToken = action.payload.fcmToken;
      state.session.user.updatedAt = action.payload.updatedAt;
    },
    updateDriverSessionLocation: (
      state,
      action: PayloadAction<{ lat: number; lng: number; updatedAt: string }>
    ) => {
      if (!state.session || state.session.user.role !== 'driver') {
        return;
      }

      state.session.user.lastKnownLocation = {
        lat: action.payload.lat,
        lng: action.payload.lng
      };
      state.session.user.lastLocationUpdatedAt = action.payload.updatedAt;
      state.session.user.updatedAt = action.payload.updatedAt;
    },
    updatePassengerSessionLocation: (
      state,
      action: PayloadAction<{ lat: number; lng: number; updatedAt: string }>
    ) => {
      if (!state.session || state.session.user.role !== 'passenger') {
        return;
      }

      state.session.user.lastKnownLocation = {
        lat: action.payload.lat,
        lng: action.payload.lng
      };
      state.session.user.lastLocationUpdatedAt = action.payload.updatedAt;
      state.session.user.updatedAt = action.payload.updatedAt;
    },
    updateRiderData: (
      state,
      action: PayloadAction<Partial<PassengerUser>>
    ) => {
      if (!state.session || state.session.user.role !== 'passenger') {
        return;
      }

      const safePayload = Object.fromEntries(
        Object.entries(action.payload).filter(([, value]) => value !== undefined)
      ) as Partial<PassengerUser>;

      // Merge the Firestore data with the existing session user
      state.session.user = {
        ...state.session.user,
        ...safePayload
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.session = action.payload;
        state.activeRole = action.payload.user.role;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        console.log('[authSlice] login.rejected', {
          payload: action.payload ?? null,
          errorMessage: action.error.message ?? null
        });
        state.status = 'unauthenticated';
        state.session = null;
        state.error = action.payload ?? action.error.message ?? 'Login failed';
      })
      .addCase(restoreSession.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.status = 'authenticated';
          state.session = action.payload;
          state.activeRole = action.payload.user.role;
        } else {
          state.status = 'unauthenticated';
          state.session = null;
        }
        state.error = null;
      })
      .addCase(restoreSession.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.session = null;
        state.error = action.payload ?? action.error.message ?? 'Unable to restore session';
      })
      .addCase(registerAndLogin.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerAndLogin.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.session = action.payload;
        state.activeRole = action.payload.user.role;
        state.error = null;
      })
      .addCase(registerAndLogin.rejected, (state, action) => {
        console.log('[authSlice] registerAndLogin.rejected', {
          payload: action.payload ?? null,
          errorMessage: action.error.message ?? null
        });
        state.status = 'unauthenticated';
        state.session = null;
        state.error = action.payload ?? action.error.message ?? 'Registration failed';
      })
      .addCase(updateDriverProfile.pending, (state) => {
        state.error = null;
      })
      .addCase(updateDriverProfile.fulfilled, (state, action) => {
        if (state.session) {
          state.session.user = action.payload;
        }
        state.error = null;
      })
      .addCase(updateDriverProfile.rejected, (state, action) => {
        state.error = action.payload ?? action.error.message ?? 'Unable to update driver profile';
      })
      .addCase(logout.fulfilled, (state) => {
        state.status = 'unauthenticated';
        state.session = null;
        state.error = null;
      });
  }
});

export const {
  setActiveRole,
  clearAuthError,
  clearSessionState,
  hydrateAuthStatus,
  updatePassengerRideState,
  updateSessionFcmToken,
  updateDriverSessionLocation,
  updatePassengerSessionLocation,
  updateRiderData,
  rebuildSessionFromProfile
} = authSlice.actions;
export const authReducer = authSlice.reducer;
