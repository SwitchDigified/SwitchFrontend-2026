import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import type { DriverPresenceWritePayload, PassengerPresenceWritePayload } from './firestoreApi';
import type { CreateRideRequestPayload, RideRequest } from '../types/ride';

// ─── Base URL ────────────────────────────────────────────────────────────────

// const BASE_URL = Platform.select({
//   android: 'http://10.68.205.234:4000',
//   ios: 'http://localhost:4000',
//   default: 'http://10.68.205.234:4000',
// });
const BASE_URL = Platform.select({
  android: 'http://10.0.2.2:4000',
  ios: 'http://localhost:4000',
  default: 'http://10.0.2.2:4000',
});

// ─── Config ──────────────────────────────────────────────────────────────────

// Timeout in milliseconds (15 seconds)
const REQUEST_TIMEOUT = 15000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StartTripPayload {
  rideId: string;
  driverId: string;
}

export interface StartTripResponse {
  rideId: string;
  status: string;
  startedAt: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

// ─── Client ──────────────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Interceptors ────────────────────────────────────────────────────────────

apiClient.interceptors.request.use((config) => {
  console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
    data: config.data,
    params: config.params
  });
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      data: response.data
    });
    return response;
  },
  (error: AxiosError) => {
    const apiError: ApiError = {
      message: 'Something went wrong. Please try again.',
      statusCode: error.response?.status,
    };

    if (error.response?.data && typeof error.response.data === 'object') {
      const data = error.response.data as Record<string, unknown>;
      if (typeof data.message === 'string') apiError.message = data.message;
    } else if (error.code === 'ECONNABORTED') {
      apiError.message = 'Request timed out. Check your connection.';
    } else if (!error.response) {
      apiError.message = 'Network error. Make sure the server is reachable.';
    }

    console.error(`[API] Error ${apiError.statusCode ?? 'Network'}: ${apiError.message}`, {
      url: error.config?.url,
      method: error.config?.method,
      data: error.response?.data
    });
    return Promise.reject(apiError);
  }
);

// ─── Rides API ───────────────────────────────────────────────────────────────

export const ridesApi = {

  createRideRequest: (payload: CreateRideRequestPayload) =>
    apiClient.post<RideRequest>('/api/rides/request', payload).then((r) => r.data),

  startTrip: (payload: StartTripPayload) =>
    apiClient.post<StartTripResponse>('/api/rides/start', payload).then((r) => r.data),

  acceptRide: (rideId: string, offerId: string, driverId: string) =>
    apiClient.post('/api/rides/accept', { rideId, offerId, driverId }).then((r) => r.data),

  skipRide: (rideId: string, offerId: string, driverId: string) =>
    apiClient.post('/api/rides/skip', { rideId, offerId, driverId }).then((r) => r.data),

  expireRideOffer: (rideId: string, offerId: string, driverId: string) =>
    apiClient.post('/api/rides/expire-offer', { rideId, offerId, driverId }).then((r) => r.data),

  cancelRide: (rideId: string, userId: string, role: 'driver' | 'passenger') =>
    apiClient.post('/api/rides/cancel', 
      role === 'driver' 
        ? { rideId, driverId: userId }
        : { rideId, passengerId: userId }
    ).then((r) => r.data),

  completeTrip: (rideId: string, driverId: string) =>
    apiClient.post('/api/rides/complete', { rideId, driverId }).then((r) => r.data),

  getRide: (rideId: string) =>
    apiClient.get(`/api/rides/${rideId}`).then((r) => r.data),
};

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  registerPassenger: (payload: Record<string, unknown>) =>
    apiClient.post('/api/auth/register/passenger', payload, { timeout: REQUEST_TIMEOUT }).then((r) => r.data),

  registerDriver: (payload: Record<string, unknown>) =>
    apiClient.post('/api/auth/register/driver', payload, { timeout: REQUEST_TIMEOUT }).then((r) => r.data),

  login: (email: string, password: string) =>
    apiClient
      .post('/api/auth/login', { email, password }, { timeout: REQUEST_TIMEOUT })
      .then((r) => r.data),
};

// ─── Firestore API ───────────────────────────────────────────────────────────

export const firestoreApi = {
  // ─── Passenger Profile ───
  getPassengerProfile: (passengerId: string) =>
    apiClient.get(`/api/firestore/passengers/${passengerId}`).then((r) => r.data),

  createPassengerProfile: (passengerId: string, payload: Record<string, unknown>) =>
    apiClient.post(`/api/firestore/passengers/${passengerId}`, payload).then((r) => r.data),

  mergePassengerProfile: (passengerId: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/api/firestore/passengers/${passengerId}`, payload).then((r) => r.data),

  // ─── Driver Profile ───
  getDriverProfile: (driverId: string) =>
    apiClient.get(`/api/firestore/drivers/${driverId}`).then((r) => r.data),

  createDriverProfile: (driverId: string, payload: Record<string, unknown>) =>
    apiClient.post(`/api/firestore/drivers/${driverId}`, payload).then((r) => r.data),

  mergeDriverProfile: (driverId: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/api/firestore/drivers/${driverId}`, payload).then((r) => r.data),

  mergeUserFcmToken: (role: 'passenger' | 'driver', userId: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/api/firestore/users/${role}/${userId}/fcm-token`, payload).then((r) => r.data),

  // ─── Driver Location ───
  createInitialDriverLocation: (driverId: string, updatedAt: string) =>
    apiClient.post(`/api/firestore/driver-locations/${driverId}/init`, { updatedAt }).then((r) => r.data),

  upsertDriverPresence: (payload: DriverPresenceWritePayload) =>
    apiClient.post('/api/firestore/driver-locations/presence', payload).then((r) => r.data),

  clearDriverActiveRide: (driverId: string, updatedAt: string) =>
    apiClient.patch(`/api/firestore/driver-locations/${driverId}/active-ride`, { updatedAt }).then((r) => r.data),

  // ─── Passenger Location ───
  createInitialPassengerLocation: (passengerId: string, updatedAt: string) =>
    apiClient.post(`/api/firestore/passenger-locations/${passengerId}/init`, { updatedAt }).then((r) => r.data),

  upsertPassengerPresence: (payload: PassengerPresenceWritePayload) =>
    apiClient.post('/api/firestore/passenger-locations/presence', payload).then((r) => r.data),

  setPassengerOfflineState: (passengerId: string, updatedAt: string) =>
    apiClient.patch(`/api/firestore/passenger-locations/${passengerId}/offline`, { updatedAt }).then((r) => r.data),

  updatePassengerRideStatus: (
    passengerId: string,
    isWaitingForRide: boolean,
    activeRideId: string | null,
    updatedAt: string
  ) =>
    apiClient.patch(`/api/firestore/passenger-locations/${passengerId}/ride-status`, {
      isWaitingForRide,
      activeRideId,
      updatedAt,
    }).then((r) => r.data),

  // ─── Rides ───
  updateRideStatus: (rideId: string, status: string, updatedAt: string) =>
    apiClient.patch(`/api/firestore/rides/${rideId}/status`, { status, updatedAt }).then((r) => r.data),

  cancelRideRequest: (rideId: string, passengerId: string) =>
    apiClient.post('/api/firestore/rides/cancel', { rideId, passengerId }).then((r) => r.data),

  // ─── Ride Offers ───
  deleteRideOffers: (rideId: string, driverId?: string) => {
    const params = new URLSearchParams();
    if (driverId) params.append('driverId', driverId);
    return apiClient.delete(`/api/firestore/ride-offers/${rideId}${params.toString() ? `?${params}` : ''}`).then((r) => r.data);
  },

  respondToRideOffer: (input: {
    driverId: string;
    offerId: string;
    rideId: string;
    status: string;
    updatedAt: string;
  }) =>
    apiClient.post('/api/firestore/ride-offers/respond', input).then((r) => r.data),
};

export default apiClient;