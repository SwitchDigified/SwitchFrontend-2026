// Initialize Firebase config FIRST - before any other imports
import './src/config/firebase';

import React, { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  checkMultiple,
  openSettings,
  PERMISSIONS,
  requestMultiple,
  RESULTS,
} from 'react-native-permissions';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';

import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SplashScreen } from './src/screens/SplashScreen';
import {
  clearSessionState,
  hydrateAuthStatus,
  restoreSession,
  rebuildSessionFromProfile,
  updatePassengerRideState,
  updateRiderData,
  updateSessionFcmToken,
} from './src/store/authSlice';
import { updateDriverProfile } from './src/store/driverProfileSlice';
import { updatePassengerProfile } from './src/store/passengerProfileSlice';
import { useAppSelector } from './src/store/hooks';
import { persistor, store } from './src/store';
import type { RootState } from './src/store';
import type { AppUser } from './src/types/auth';
import { firestoreApi } from './src/api/apiClient';
import {
  listenToActivePassengerRide,
  listenToRiderData,
} from './src/listeners';
import { setRide } from './src/store/rideSlice';
import { DriverRideSheetHost } from './src/components/bottomsheets';
import { clearCurrentRide } from './src/store/driverCurrentRideSlice';
import { ToastContainer } from './src/components/Toast';
import { initializeNetworkMonitoring } from './src/services/networkService';

const pickPersistedProfile = (
  state: RootState,
  firebaseUid: string
): RootState['driverProfile'] | RootState['passengerProfile'] => {
  const profiles = [state.driverProfile, state.passengerProfile].filter(
    (profile): profile is NonNullable<typeof profile> => Boolean(profile)
  );

  if (profiles.length === 0) {
    return null;
  }

  return (
    profiles.find((profile) => profile.id === firebaseUid) ??
    profiles.find((profile) => profile.role === state.auth.activeRole) ??
    profiles[0]
  );
};

function RootNavigator() {
  const { session, status } = useAppSelector(state => state.auth);
  const unsubscribeRideRef = useRef<(() => void) | null>(null);
  const unsubscribeRiderRef = useRef<(() => void) | null>(null);
  const unsubscribeTokenRefreshRef = useRef<(() => void) | null>(null);
  const [authReady, setAuthReady] = React.useState(false);

  useEffect(() => {
    const auth = getAuth();

   

    // Wait for Firebase to restore the native auth session before starting
    // the Firestore listener. Redux persist may rehydrate session before
    // Firebase auth is ready, which causes permission-denied errors.
    const unsubscribeAuth = onAuthStateChanged(auth, async firebaseUser => {
      console.log('[RootNavigator] onAuthStateChanged', {
        uid: firebaseUser?.uid ?? null,
        email: firebaseUser?.email ?? null,
      });

      // Clean up any previous ride listener
      unsubscribeRideRef.current?.();
      unsubscribeRideRef.current = null;
      unsubscribeRiderRef.current?.();
      unsubscribeRiderRef.current = null;
      unsubscribeTokenRefreshRef.current?.();
      unsubscribeTokenRefreshRef.current = null;
      if (firebaseUser) {
        console.log('[RootNavigator] Firebase user exists, attempting to restore session');
        await store.dispatch(restoreSession());
        let restoredSession = store.getState().auth.session;

        // If no valid session from Redux but we have a Firebase user,
        // rebuild session from persisted profile and ensure we always keep uid.
        if (!restoredSession?.user?.id) {
          const state = store.getState();
          const profile = pickPersistedProfile(state, firebaseUser.uid);
          
          if (profile && profile.email && profile.firstName && profile.lastName) {
            const profileWithId = {
              ...profile,
              id: profile.id || firebaseUser.uid
            };

            console.log('[RootNavigator] Rebuilding session from persisted profile', { 
              role: profileWithId.role, 
              uid: profileWithId.id
            });
            store.dispatch(rebuildSessionFromProfile(profileWithId as AppUser));
            restoredSession = store.getState().auth.session;
            console.log('[RootNavigator] Session rebuilt with user:', { 
              id: restoredSession?.user.id,
              role: restoredSession?.user.role,
              email: restoredSession?.user.email
            });
          } else {
            console.log('[RootNavigator] Profile incomplete or missing fields, clearing session', {
              profileExists: Boolean(profile),
              hasId: Boolean(profile?.id || firebaseUser.uid),
              hasEmail: Boolean(profile?.email),
              hasFirstName: Boolean(profile?.firstName),
              hasLastName: Boolean(profile?.lastName)
            });
            store.dispatch(clearSessionState());
          }
        }


        // Ensure we never carry a stale persisted driver ride into a non-driver session.
        if (restoredSession?.user.role !== 'driver') {
          store.dispatch(clearCurrentRide());
        }

        unsubscribeRideRef.current = listenToActivePassengerRide(
          firebaseUser.uid,
          ride => {
            // console.log('updated ride data from firestore:', ride);
            if (!ride) {
              store.dispatch(
                updateRiderData({
                  rideStatus: 'idle',
                  activeRideId: null
                })
              );
              return;
            }
            store.dispatch(setRide(ride));
            store.dispatch(
              updatePassengerRideState({
                rideStatus: (ride?.status as any) ?? 'idle',
                activeRideId: ride?.id ?? null,
              }),
            );
          },
          error => {
            console.error('[rideListener] error:', error);
          },
        );

        unsubscribeRiderRef.current = listenToRiderData(
          firebaseUser.uid,
          store.dispatch,
          error => {
            console.error('[riderListener] error:', error);
          },
        );

      
      } else {
        console.log('[RootNavigator] Firebase auth: no user signed in');
        store.dispatch(clearSessionState());
        store.dispatch(setRide(null));
        store.dispatch(clearCurrentRide());
        store.dispatch(
          updatePassengerRideState({
            rideStatus: 'idle',
            activeRideId: null,
          }),
        );
      }

      // Set authReady AFTER all state updates are dispatched
      setAuthReady(true);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRideRef.current?.();
      unsubscribeRideRef.current = null;
      unsubscribeRiderRef.current?.();
      unsubscribeRiderRef.current = null;
      unsubscribeTokenRefreshRef.current?.();
      unsubscribeTokenRefreshRef.current = null;
    };
  }, []);

  if (!authReady) {
    return <SplashScreen />;
  }

  // Always ensure we have something to render
  if (!session && status === 'authenticated') {
    // Session data is being restored, show splash
    return <SplashScreen />;
  }

  const isDriverSession = session?.user.role === 'driver';

  if (session && status === 'authenticated') {
    return (
      <>
        <HomeScreen />
        {isDriverSession ? <DriverRideSheetHost /> : null}
      </>
    );
  }

  // Default to auth screen if not authenticated
  return <AuthScreen />;
}

function App() {
  useEffect(() => {
    // Initialize network monitoring on app start
    console.log('[App] Initializing network monitoring');
    const unsubscribeNetwork = initializeNetworkMonitoring();
    
    return () => {
      unsubscribeNetwork();
    };
  }, []);

  useEffect(() => {
    const requestAndroidLocationPermission = async () => {
      if (Platform.OS !== 'android') {
        return;
      }

      const permissions = [
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      ];

      const currentStatuses = await checkMultiple(permissions);
      const hasLocationPermission = permissions.some(
        permission => currentStatuses[permission] === RESULTS.GRANTED,
      );

      if (hasLocationPermission) {
        return;
      }

      const requestedStatuses = await requestMultiple(permissions);
      const grantedAfterRequest = permissions.some(
        permission => requestedStatuses[permission] === RESULTS.GRANTED,
      );

      if (!grantedAfterRequest) {
        const isBlocked = permissions.some(
          permission => requestedStatuses[permission] === RESULTS.BLOCKED,
        );

        if (isBlocked) {
          Alert.alert(
            'Location permission required',
            'Enable location permission in settings to use map location features.',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Open settings',
                onPress: () => {
                  openSettings().catch(() => undefined);
                },
              },
            ],
          );
        }
      }
    };

    requestAndroidLocationPermission().catch(() => undefined);
  }, []);

  return (
    <Provider store={store}>
      <PersistGate
        persistor={persistor}
        loading={<SplashScreen />}
        onBeforeLift={() => {
          store.dispatch(hydrateAuthStatus());
        }}
      >
        <SafeAreaProvider>
          <RootNavigator />
          <ToastContainer />
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
