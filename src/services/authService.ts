import {
  createUserWithEmailAndPassword,
  deleteUser,
  fetchSignInMethodsForEmail,
  getAuth,
  getIdToken,
  getIdTokenResult,
  signInWithEmailAndPassword,
  signOut,
} from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import { z } from 'zod';
import {
  createDriverProfileDoc,
  createInitialDriverLocationDoc,
  createInitialPassengerLocationDoc,
  createPassengerProfileDoc,
  getDriverProfileDoc,
  getPassengerProfileDoc,
  mergeDriverProfileDoc,
  mergeUserFcmTokenDoc,
} from '../api/firestoreApi';

import type {
  DriverProfileUpdatePayload,
  DriverRegisterPayload,
  DriverUserFromApi,
  LoginPayload,
  PassengerRegisterPayload,
  PassengerUser
} from '../types/auth';

type ServiceErrorCode = 'BAD_REQUEST' | 'CONFLICT' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'INTERNAL_ERROR';

export type ServiceError = Error & {
  status: number;
  code: ServiceErrorCode;
};

export type PassengerUserDocument = PassengerUser;
export type DriverUserDocument = DriverUserFromApi;

type StoredUserDocument = PassengerUserDocument | DriverUserDocument;

type LoginResult = {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: StoredUserDocument;
};

const auth = getAuth();

const requiredString = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`);

const emailSchema = z
  .string()
  .trim()
  .email('email must be a valid email address')
  .transform((email) => email.toLowerCase());

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'phone must be a valid E.164 international number');

const passwordSchema = z.string().min(6, 'password must be at least 6 characters');

const isoDateStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a valid ISO date string');

// Schema to handle Firestore Timestamp objects or ISO strings
const firestoreDateSchema = z
  .unknown()
  .transform((val): string => {
    // If it's already a string, return it
    if (typeof val === 'string') {
      return val;
    }
    
    // Check if it's a Firestore Timestamp object with toDate method
    if (val && typeof val === 'object' && '_seconds' in val) {
      const timestamp = val as any;
      try {
        // Try calling toDate() if it exists
        if (typeof timestamp.toDate === 'function') {
          return timestamp.toDate().toISOString();
        }
        // Fallback: construct from _seconds
        if (typeof timestamp._seconds === 'number') {
          return new Date(timestamp._seconds * 1000).toISOString();
        }
      } catch (error) {
        console.error('[firestoreDateSchema] Error converting timestamp:', error);
      }
    }
    
    // Fallback for unknown types
    return new Date().toISOString();
  });

const basicProfileSchema = z
  .object({
    idNumber: requiredString('basicProfile.idNumber'),
    driverLicenseUrl: z.string().trim().url('basicProfile.driverLicenseUrl must be a valid URL'),
    profilePhotoUrl: z.string().trim().url('basicProfile.profilePhotoUrl must be a valid URL'),
    ninSlipUrl: z.string().trim().url('basicProfile.ninSlipUrl must be a valid URL')
  });

const vehicleDetailsSchema = z
  .object({
    make: requiredString('vehicleDetails.make'),
    model: requiredString('vehicleDetails.model'),
    color: requiredString('vehicleDetails.color'),
    plateNumber: requiredString('vehicleDetails.plateNumber')
  });

const preferenceSchema = z
  .object({
    earningPreference: z.enum(['one_time_payment_daily', 'commission_based', 'subscription'])
  });

const passengerRideStatusSchema = z.enum([
  'idle',
  'requesting',
  'searching_driver',
  'requested',
  'accepted',
  'arrived',
  'on_trip',
  'on_ride',
  'completed',
  'cancelled'
]);

const registrationBaseSchema = z
  .object({
    firstName: requiredString('firstName').max(50),
    lastName: requiredString('lastName').max(50),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    termsAccepted: z.literal(true)
  })
  .strict();

const passengerRegistrationSchema = registrationBaseSchema.extend({
  dateOfBirth: isoDateStringSchema.optional()
});

const driverRegistrationSchema = registrationBaseSchema.extend({
  basicProfile: basicProfileSchema.optional(),
  vehicleDetails: vehicleDetailsSchema.optional(),
  preference: preferenceSchema.optional()
});

const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'password is required')
  })
  .strict();

const driverProfileUpdateSchema = z
  .object({
    firstName: requiredString('firstName').max(50).optional(),
    lastName: requiredString('lastName').max(50).optional(),
    phone: phoneSchema.optional(),
    basicProfile: basicProfileSchema.optional(),
    vehicleDetails: vehicleDetailsSchema.optional(),
    preference: preferenceSchema.optional()
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided'
  });

const storedPassengerSchema = z
  .object({
    id: z.string().min(1),
    role: z.literal('passenger'),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: phoneSchema,
    fcmToken: z.string().optional().default(''),
    isOnline: z.boolean().optional().default(false),
    isAvailable: z.boolean().optional().default(false),
    activeRideId: z.string().trim().min(1).nullable().optional().default(null),
    lastKnownLocation: z
      .object({
        lat: z.number().finite(),
        lng: z.number().finite()
      })
      .optional(),
    lastKnownGeohash: z.string().optional(),
    lastLocationUpdatedAt: firestoreDateSchema.optional(),
    termsAccepted: z.literal(true),
    createdAt: firestoreDateSchema,
    updatedAt: firestoreDateSchema,
    dateOfBirth: z.string().optional(),
    walletBalance: z.number().finite().default(0),
    switchCoinBalance: z.number().finite().default(0),
    rideStatus: passengerRideStatusSchema
  })
  .passthrough();

const storedDriverSchema = z
  .object({
    id: z.string().min(1),
    role: z.literal('driver'),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: phoneSchema,
    fcmToken: z.string().optional().default(''),
    termsAccepted: z.literal(true),
    createdAt: firestoreDateSchema,
    updatedAt: firestoreDateSchema,
    ratingAverage: z.number().finite().min(0).max(5).default(0),
    ratingCount: z.number().int().min(0).default(0),
    completedTrips: z.number().int().min(0).default(0),
    basicProfile: basicProfileSchema.optional(),
    vehicleDetails: vehicleDetailsSchema.optional(),
    preference: preferenceSchema.optional()
  })
  .passthrough();

const createServiceError = (status: number, code: ServiceErrorCode, message: string): ServiceError => {
  const error = new Error(message) as ServiceError;
  error.status = status;
  error.code = code;
  return error;
};

export const isServiceError = (error: unknown): error is ServiceError => {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
};

const getFirebaseErrorCode = (error: unknown): string | undefined => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const maybeCode = (error as { code?: unknown }).code;
    if (typeof maybeCode === 'string') {
      return maybeCode;
    }
  }

  return undefined;
};

const maskEmailForLog = (email: string): string => {
  const [localPart, domainPart] = email.split('@');

  if (!localPart || !domainPart) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? '*'}*@${domainPart}`;
  }

  return `${localPart.slice(0, 2)}***@${domainPart}`;
};

const mapFirebaseError = (error: unknown): ServiceError => {
  const code = getFirebaseErrorCode(error);

  switch (code) {
    case 'auth/email-already-in-use':
      return createServiceError(409, 'CONFLICT', 'An account with this email already exists');
    case 'auth/invalid-email':
      return createServiceError(400, 'BAD_REQUEST', 'Invalid email address');
    case 'auth/weak-password':
      return createServiceError(400, 'BAD_REQUEST', 'Password is too weak');
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return createServiceError(401, 'UNAUTHORIZED', 'Invalid email or password');
    case 'auth/too-many-requests':
      return createServiceError(429, 'BAD_REQUEST', 'Too many login attempts. Please try later');
    case 'auth/user-disabled':
      return createServiceError(401, 'UNAUTHORIZED', 'Account is disabled');
    case 'auth/network-request-failed':
      return createServiceError(500, 'INTERNAL_ERROR', 'Network error. Please check your connection');
    case 'firestore/permission-denied':
      return createServiceError(403, 'UNAUTHORIZED', 'Permission denied');
    case 'firestore/unavailable':
      return createServiceError(500, 'INTERNAL_ERROR', 'Database service is temporarily unavailable');
    default:
      return createServiceError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};

const parsePassenger = (value: unknown): PassengerUserDocument => {
  const parsed = storedPassengerSchema.safeParse(value);
  if (!parsed.success) {
    console.error('[authService] parsePassenger:validation-error', {
      value: typeof value === 'object' ? (value as Record<string, unknown>) : value,
      errors: parsed.error.flatten()
    });
    throw createServiceError(500, 'INTERNAL_ERROR', 'Stored passenger profile has invalid format');
  }

  const rideStatus = parsed.data.rideStatus === 'requesting' || parsed.data.rideStatus === 'searching_driver'
    ? 'requested'
    : parsed.data.rideStatus === 'on_ride'
      ? 'on_trip'
      : parsed.data.rideStatus;

  return {
    ...parsed.data,
    rideStatus,
    activeRideId: parsed.data.activeRideId ?? null
  };
};

const parseDriver = (value: unknown): DriverUserDocument => {
  const parsed = storedDriverSchema.safeParse(value);
  if (!parsed.success) {
    console.error('[authService] parseDriver:validation-error', {
      value: typeof value === 'object' ? (value as Record<string, unknown>) : value,
      errors: parsed.error.flatten()
    });
    throw createServiceError(500, 'INTERNAL_ERROR', 'Stored driver profile has invalid format');
  }

  return parsed.data;
};

const getStoredUserById = async (userId: string): Promise<StoredUserDocument> => {
  console.log('[authService] getStoredUserById:start', {
    userId
  });

  const passengerSnapshot = await getPassengerProfileDoc(userId);
  if (passengerSnapshot.exists) {
    console.log('[authService] getStoredUserById:found-passenger', {
      userId
    });
    const passengerData = passengerSnapshot.data();
    console.log('[authService] getStoredUserById:passenger-raw-data', {
      data: passengerData,
      keys: Object.keys(passengerData || {}),
      dataTypes: passengerData ? Object.entries(passengerData).reduce((acc, [key, val]) => {
        acc[key] = typeof val;
        return acc;
      }, {} as Record<string, string>) : {}
    });
    return parsePassenger(passengerData);
  }

  const driverSnapshot = await getDriverProfileDoc(userId);
  if (driverSnapshot.exists) {
    console.log('[authService] getStoredUserById:found-driver', {
      userId
    });
    const driverData = driverSnapshot.data();
    console.log('[authService] getStoredUserById:driver-raw-data', {
      data: driverData,
      keys: Object.keys(driverData || {}),
      dataTypes: driverData ? Object.entries(driverData).reduce((acc, [key, val]) => {
        acc[key] = typeof val;
        return acc;
      }, {} as Record<string, string>) : {}
    });
    return parseDriver(driverData);
  }

  console.log('[authService] getStoredUserById:not-found', {
    userId
  });

  throw createServiceError(404, 'NOT_FOUND', 'User profile not found');
};

const ensureEmailIsAvailable = async (email: string) => {
  console.log('[authService] ensureEmailIsAvailable:req', {
    email: maskEmailForLog(email)
  });

  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);

    console.log('[authService] ensureEmailIsAvailable:res', {
      email: maskEmailForLog(email),
      methods
    });

    if (methods.length > 0) {
      throw createServiceError(409, 'CONFLICT', 'An account with this email already exists');
    }
  } catch (error) {
    const mappedError = isServiceError(error) ? error : mapFirebaseError(error);

    console.log('[authService] ensureEmailIsAvailable:error', {
      email: maskEmailForLog(email),
      firebaseCode: getFirebaseErrorCode(error) ?? null,
      status: mappedError.status,
      code: mappedError.code,
      message: mappedError.message
    });

    if (isServiceError(error)) {
      throw error;
    }

    throw mappedError;
  }
};

export const getDeviceFcmToken = async (): Promise<string> => {
  try {
    console.log('[authService] 🔑 Getting FCM token...');
    
    // Step 1: Request notification permissions (required on iOS 13+)
    console.log('[authService] 📲 Requesting notification permissions...');
    try {
      const permissionStatus = await messaging().requestPermission();
      console.log('[authService] ✓ Permission status:', {
        status: permissionStatus,
        canGetToken: permissionStatus === messaging.AuthorizationStatus.AUTHORIZED || 
                     permissionStatus === messaging.AuthorizationStatus.PROVISIONAL,
      });
    } catch (permissionError) {
      console.warn('[authService] ⚠️  requestPermission failed or denied:', {
        message: permissionError instanceof Error ? permissionError.message : String(permissionError),
      });
      // Continue anyway - user may have already granted permission
    }

    // Step 2: Register device (only needed if not auto-registered)
    try {
      console.log('[authService] 📱 Registering device for remote messages...');
      await messaging().registerDeviceForRemoteMessages();
      console.log('[authService] ✓ Device registered');
    } catch (registerError) {
      console.log('[authService] ℹ️  registerDeviceForRemoteMessages skipped:', 
        (registerError as any)?.code || String(registerError));
      // Continue - might still be able to get token
    }

    // Step 3: Get the FCM token
    console.log('[authService] 🔄 Calling messaging().getToken()...');
    const token = await messaging().getToken();
    
    console.log('[authService] ✓ Got token:', {
      value: token ? token.slice(0, 30) + '...' : 'EMPTY',
      length: token?.length || 0,
    });

    if (!token || token === '') {
      console.error('[authService] ❌ getToken returned empty/null');
      return '';
    }

    const trimmed = token.trim();
    console.log('[authService] ✅ Token ready:', trimmed.slice(0, 30) + '...');
    return trimmed;
    
  } catch (error) {
    console.error('[authService] ❌ FAILED getting FCM token:', {
      code: (error as any)?.code,
      message: error instanceof Error ? error.message : String(error),
      namespace: (error as any)?.namespace,
      hint: 'Check iOS notification permissions and Firebase setup',
    });
    return '';
  }
};

export const registerPassenger = async (input: PassengerRegisterPayload): Promise<PassengerUserDocument> => {
  const payload = passengerRegistrationSchema.parse(input);
  const startedAt = Date.now();
  const fcmToken = await getDeviceFcmToken();

  console.log('[authService] registerPassenger:req', {
    email: maskEmailForLog(payload.email),
    firstName: payload.firstName,
    lastName: payload.lastName,
    hasDateOfBirth: Boolean(payload.dateOfBirth)
  });

  await ensureEmailIsAvailable(payload.email);

  const timestamp = new Date().toISOString();
  let uid: string | undefined;

  try {
    const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
    uid = credential.user.uid;

    console.log('[authService] registerPassenger:auth-created', {
      email: maskEmailForLog(payload.email),
      uid,
      durationMs: Date.now() - startedAt
    });

    const passengerDoc: PassengerUserDocument = {
      id: uid,
      role: 'passenger',
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      fcmToken,
      termsAccepted: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      walletBalance: 0,
      switchCoinBalance: 3050,
      activeRideId: null,
      rideStatus: 'idle',
      ...(payload.dateOfBirth ? { dateOfBirth: payload.dateOfBirth } : {})
    };

    await createPassengerProfileDoc(uid, passengerDoc as unknown as Record<string, unknown>);

    // Create initial passenger_locations document for real-time location tracking
    await createInitialPassengerLocationDoc(uid, timestamp);

    console.log('[authService] registerPassenger:firestore-write-success', {
      uid,
      durationMs: Date.now() - startedAt
    });

    return passengerDoc;
  } catch (error) {
    const mappedError = isServiceError(error) ? error : mapFirebaseError(error);

    console.log('[authService] registerPassenger:error', {
      email: maskEmailForLog(payload.email),
      uid: uid ?? null,
      firebaseCode: getFirebaseErrorCode(error) ?? null,
      status: mappedError.status,
      code: mappedError.code,
      message: mappedError.message,
      durationMs: Date.now() - startedAt
    });

    if (uid && auth.currentUser) {
      console.log('[authService] registerPassenger:cleanup-delete-current-user', {
        uid: auth.currentUser.uid
      });
      await deleteUser(auth.currentUser).catch(() => undefined);
    }

    if (isServiceError(error)) {
      throw error;
    }

    throw mappedError;
  }
};

export const registerDriver = async (input: DriverRegisterPayload): Promise<DriverUserDocument> => {
  const payload = driverRegistrationSchema.parse(input);
  const startedAt = Date.now();
  const fcmToken = await getDeviceFcmToken();

  console.log('[authService] registerDriver:req', {
    email: maskEmailForLog(payload.email),
    firstName: payload.firstName,
    lastName: payload.lastName,
    hasBasicProfile: Boolean(payload.basicProfile),
    hasVehicleDetails: Boolean(payload.vehicleDetails),
    hasPreference: Boolean(payload.preference)
  });

  await ensureEmailIsAvailable(payload.email);

  const timestamp = new Date().toISOString();
  let uid: string | undefined;

  try {
    const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
    uid = credential.user.uid;

    console.log('[authService] registerDriver:auth-created', {
      email: maskEmailForLog(payload.email),
      uid,
      durationMs: Date.now() - startedAt
    });

    const driverDoc: DriverUserDocument = {
      id: uid,
      role: 'driver',
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      fcmToken,
      termsAccepted: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      ratingAverage: 0,
      ratingCount: 0,
      completedTrips: 0,
      ...(payload.basicProfile ? { basicProfile: payload.basicProfile } : {}),
      ...(payload.vehicleDetails ? { vehicleDetails: payload.vehicleDetails } : {}),
      ...(payload.preference ? { preference: payload.preference } : {})
    };

    // Create driver profile document (static data)
    await createDriverProfileDoc(uid, driverDoc as unknown as Record<string, unknown>);

    // Initialize driver location document (dynamic/real-time data)
    // Ensures the driver has an entry in driver_locations from day 1
    await createInitialDriverLocationDoc(uid, timestamp);

    console.log('[authService] registerDriver:firestore-write-success', {
      uid,
      durationMs: Date.now() - startedAt
    });

    return driverDoc;
  } catch (error) {
    const mappedError = isServiceError(error) ? error : mapFirebaseError(error);

    console.log('[authService] registerDriver:error', {
      email: maskEmailForLog(payload.email),
      uid: uid ?? null,
      firebaseCode: getFirebaseErrorCode(error) ?? null,
      status: mappedError.status,
      code: mappedError.code,
      message: mappedError.message,
      durationMs: Date.now() - startedAt
    });

    if (uid && auth.currentUser) {
      console.log('[authService] registerDriver:cleanup-delete-current-user', {
        uid: auth.currentUser.uid
      });
      await deleteUser(auth.currentUser).catch(() => undefined);
    }

    if (isServiceError(error)) {
      throw error;
    }

    throw mappedError;
  }
};

export const loginUser = async (input: LoginPayload): Promise<LoginResult> => {
  const payload = loginSchema.parse(input);
  const startedAt = Date.now();

  console.log('[authService] loginUser:start', {
    email: maskEmailForLog(payload.email)
  });

  try {
    const credential = await signInWithEmailAndPassword(auth, payload.email, payload.password);
    const user = credential.user;

    console.log('[authService] loginUser:firebase-auth-success', {
      email: maskEmailForLog(payload.email),
      uid: user?.uid ?? null,
      durationMs: Date.now() - startedAt
    });

    if (!user) {
      throw createServiceError(401, 'UNAUTHORIZED', 'Unable to login with provided credentials');
    }

    const token = await getIdToken(user);
    const tokenResult = await getIdTokenResult(user);
    const expiresIn = tokenResult.expirationTime
      ? Math.floor((new Date(tokenResult.expirationTime).getTime() - Date.now()) / 1000)
      : 3600;

    const storedUser = await getStoredUserById(user.uid);

    console.log('[authService] loginUser:profile-loaded', {
      uid: user.uid,
      role: storedUser.role,
      durationMs: Date.now() - startedAt
    });

    return {
      token,
      refreshToken: '',
      expiresIn,
      user: storedUser
    };
  } catch (error) {
    if (isServiceError(error)) {
      console.log('[authService] loginUser:error', {
        email: maskEmailForLog(payload.email),
        durationMs: Date.now() - startedAt,
        status: error.status,
        code: error.code,
        message: error.message
      });
      throw error;
    }

    const mappedError = mapFirebaseError(error);

    console.log('[authService] loginUser:error', {
      email: maskEmailForLog(payload.email),
      durationMs: Date.now() - startedAt,
      firebaseCode: getFirebaseErrorCode(error) ?? null,
      originalMessage: error instanceof Error ? error.message : 'Unknown error',
      status: mappedError.status,
      code: mappedError.code,
      message: mappedError.message
    });

    throw mappedError;
  }
};

export const restoreSessionUser = async (): Promise<LoginResult | null> => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  const token = await getIdToken(currentUser);
  const tokenResult = await getIdTokenResult(currentUser);
  const expiresIn = tokenResult.expirationTime
    ? Math.floor((new Date(tokenResult.expirationTime).getTime() - Date.now()) / 1000)
    : 3600;
  const storedUser = await getStoredUserById(currentUser.uid);

  return {
    token,
    refreshToken: '',
    expiresIn,
    user: storedUser
  };
};

export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    if (isServiceError(error)) {
      throw error;
    }

    throw mapFirebaseError(error);
  }
};

export const updateDriverProfile = async (
  driverId: string,
  input: DriverProfileUpdatePayload
): Promise<DriverUserDocument> => {
  const payload = driverProfileUpdateSchema.parse(input);
  const snapshot = await getDriverProfileDoc(driverId);

  if (!snapshot.exists) {
    throw createServiceError(404, 'NOT_FOUND', 'Driver profile not found');
  }

  const currentDriver = parseDriver(snapshot.data());
  const updatedAt = new Date().toISOString();
  const updatePayload: Partial<DriverUserDocument> = {
    ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
    ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
    ...(payload.basicProfile !== undefined ? { basicProfile: payload.basicProfile } : {}),
    ...(payload.vehicleDetails !== undefined ? { vehicleDetails: payload.vehicleDetails } : {}),
    ...(payload.preference !== undefined ? { preference: payload.preference } : {}),
    updatedAt
  };

  await mergeDriverProfileDoc(driverId, updatePayload as unknown as Record<string, unknown>);

  return {
    ...currentDriver,
    ...updatePayload
  };
};

export const syncCurrentUserFcmToken = async (token?: string): Promise<StoredUserDocument | null> => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  const nextFcmToken = (token ?? await getDeviceFcmToken()).trim();
  if (!nextFcmToken) {
    return null;
  }

  const storedUser = await getStoredUserById(currentUser.uid);
  if (storedUser.fcmToken === nextFcmToken) {
    return storedUser;
  }

  const updatedAt = new Date().toISOString();
  const updatePayload = {
    fcmToken: nextFcmToken,
    updatedAt
  };

  await mergeUserFcmTokenDoc(
    storedUser.role,
    currentUser.uid,
    updatePayload as unknown as Record<string, unknown>
  );

  return {
    ...storedUser,
    ...updatePayload
  };
};
