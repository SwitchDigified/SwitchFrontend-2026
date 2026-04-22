import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { getDeviceFcmToken } from '../../../services/authService';
import { firestoreApi } from '../../../api/apiClient';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { updatePassengerProfile } from '../../../store/passengerProfileSlice';

/**
 * Hook to sync FCM token from Firebase with Firestore and Redux
 * - Retrieves the device FCM token on mount and app focus
 * - Updates Firestore passenger profile with the token
 * - Updates Redux store with the token
 * - Listens for FCM token refreshes and syncs them automatically
 */
export function useFcmTokenSync() {
  const dispatch = useAppDispatch();
  const passengerProfile = useAppSelector((s) => s.passengerProfile);
  const isSyncingRef = useRef(false);
  const lastTokenRef = useRef<string>('');

  useEffect(() => {
    console.log('[FCM] Hook mounted');
    console.log('[FCM] Passenger Profile:', {
      hasProfile: !!passengerProfile,
      id: passengerProfile?.id,
      currentFcmToken: passengerProfile?.fcmToken ? passengerProfile.fcmToken.slice(0, 20) + '...' : 'EMPTY',
    });
  }, [passengerProfile?.id]);

  /**
   * Syncs the current FCM token to Firestore and Redux
   */
  const syncFcmToken = useCallback(async () => {
    console.log('[FCM] syncFcmToken called');
    
    if (!passengerProfile) {
      console.log('[FCM] ❌ Passenger profile not loaded, skipping sync');
      return;
    }

    console.log('[FCM] ✓ Passenger profile exists:', passengerProfile.id);

    if (isSyncingRef.current) {
      console.log('[FCM] ⏳ Sync already in progress, skipping');
      return;
    }

    isSyncingRef.current = true;
    console.log('[FCM] 🔄 Starting sync...');

    try {
      console.log('[FCM] 📱 Fetching FCM token from Firebase...');
      const fcmToken = await getDeviceFcmToken();
      console.log('[FCM] ✓ Got FCM token:', fcmToken ? fcmToken.slice(0, 20) + '...' : 'EMPTY STRING');

      if (!fcmToken) {
        console.warn('[FCM] ❌ FCM token is empty or undefined');
        isSyncingRef.current = false;
        return;
      }

      // Check if token has changed
      if (fcmToken === lastTokenRef.current && fcmToken === passengerProfile.fcmToken) {
        console.log('[FCM] ⏭️  Token unchanged, skipping update');
        console.log('[FCM]   Last token:    ' + lastTokenRef.current.slice(0, 20) + '...');
        console.log('[FCM]   Profile token: ' + passengerProfile.fcmToken.slice(0, 20) + '...');
        isSyncingRef.current = false;
        return;
      }

      console.log('[FCM] 🔄 Token has changed, updating...');
      console.log('[FCM] Syncing token:', {
        old: passengerProfile.fcmToken ? passengerProfile.fcmToken.slice(0, 20) + '...' : 'empty',
        new: fcmToken.slice(0, 20) + '...',
      });

      lastTokenRef.current = fcmToken;

      // Update Firestore via API
      console.log('[FCM] 🌐 Sending to Firestore...');
      const payload = {
        fcmToken,
        updatedAt: new Date().toISOString(),
      };
      console.log('[FCM] API Payload:', {
        role: 'passenger',
        userId: passengerProfile.id,
        fcmToken: payload.fcmToken.slice(0, 20) + '...',
        updatedAt: payload.updatedAt,
      });
      
      await firestoreApi.mergeUserFcmToken('passenger', passengerProfile.id, payload);
      console.log('[FCM] ✓ Firestore updated successfully');

      // Update Redux store
      console.log('[FCM] 📦 Updating Redux store...');
      dispatch(
        updatePassengerProfile({
          fcmToken,
        })
      );
      console.log('[FCM] ✓ Redux updated');
      console.log('[FCM] ✅ Token synced successfully!');
    } catch (error) {
      console.error('[FCM] ❌ Error syncing token:', {
        message: error instanceof Error ? error.message : String(error),
        error: error,
      });
    } finally {
      isSyncingRef.current = false;
    }
  }, [passengerProfile, dispatch]);

  /**
   * Listen for FCM token refresh events
   * Firebase automatically refreshes tokens periodically
   */
  useEffect(() => {
    if (!passengerProfile) {
      console.log('[FCM] 🚫 No passenger profile, skipping refresh listener setup');
      return;
    }

    console.log('[FCM] 👂 Setting up token refresh listener for passenger');

    const unsubscribe = messaging().onTokenRefresh((newToken) => {
      console.log('[FCM] 🔄 Firebase triggered token refresh!');
      console.log('[FCM] 📱 New token from Firebase:', newToken.slice(0, 20) + '...');
      syncFcmToken();
    });

    return () => {
      console.log('[FCM] 🛑 Cleaning up token refresh listener');
      unsubscribe();
    };
  }, [passengerProfile, syncFcmToken]);

  /**
   * Sync token when app comes to foreground
   */
  const handleAppStateChange = useCallback(
    (state: AppStateStatus) => {
      console.log('[FCM] 📲 App state changed to:', state);
      if (state === 'active') {
        console.log('[FCM] 🎉 App came to foreground, triggering token sync...');
        syncFcmToken();
      } else {
        console.log('[FCM] 👋 App went to background');
      }
    },
    [syncFcmToken]
  );

  useEffect(() => {
    console.log('[FCM] 📳 Subscribing to AppState changes');
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      console.log('[FCM] 🛑 Unsubscribing from AppState changes');
      subscription.remove();
    };
  }, [handleAppStateChange]);

  /**
   * Initial sync when passenger profile is loaded
   */
  useEffect(() => {
    if (!passengerProfile) {
      console.log('[FCM] ⏭️  Skipping initial sync - no profile');
      return;
    }

    console.log('[FCM] 🔍 Checking if initial sync needed...');
    console.log('[FCM]    Profile ID:', passengerProfile.id);
    console.log('[FCM]    Current fcmToken:', passengerProfile.fcmToken === '' ? '⚠️  EMPTY' : '✓ Set');

    if (passengerProfile.fcmToken === '') {
      console.log('[FCM] 🚀 Passenger profile loaded with empty token, triggering sync...');
      syncFcmToken();
    } else {
      console.log('[FCM] ✓ FCM token already set, skipping initial sync');
    }
  }, [passengerProfile?.id, passengerProfile?.fcmToken, syncFcmToken]);

  return {
    syncFcmToken,
  };
}
