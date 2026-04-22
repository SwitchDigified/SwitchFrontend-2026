import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { getDeviceFcmToken } from '../../../services/authService';
import { firestoreApi } from '../../../api/apiClient';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { updateDriverProfile } from '../../../store/driverProfileSlice';

/**
 * Hook to sync FCM token from Firebase with Firestore and Redux
 * - Retrieves the device FCM token on mount and app focus
 * - Updates Firestore driver profile with the token
 * - Updates Redux store with the token
 * - Listens for FCM token refreshes and syncs them automatically
 */
export function useFcmTokenSync() {
  const dispatch = useAppDispatch();
  const driverProfile = useAppSelector((s) => s.driverProfile);
  const isSyncingRef = useRef(false);
  const lastTokenRef = useRef<string>('');

  useEffect(() => {
    console.log('[FCM] Hook mounted');
    console.log('[FCM] Driver Profile:', {
      hasProfile: !!driverProfile,
      id: driverProfile?.id,
      currentFcmToken: driverProfile?.fcmToken ? driverProfile.fcmToken.slice(0, 20) + '...' : 'EMPTY',
    });
  }, [driverProfile?.id]);

  /**
   * Syncs the current FCM token to Firestore and Redux
   */
  const syncFcmToken = useCallback(async () => {
    console.log('[FCM] syncFcmToken called');
    
    if (!driverProfile) {
      console.log('[FCM] ❌ Driver profile not loaded, skipping sync');
      return;
    }

    console.log('[FCM] ✓ Driver profile exists:', driverProfile.id);

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
      if (fcmToken === lastTokenRef.current && fcmToken === driverProfile.fcmToken) {
        console.log('[FCM] ⏭️  Token unchanged, skipping update');
        console.log('[FCM]   Last token:    ' + lastTokenRef.current.slice(0, 20) + '...');
        console.log('[FCM]   Profile token: ' + driverProfile.fcmToken.slice(0, 20) + '...');
        isSyncingRef.current = false;
        return;
      }

      console.log('[FCM] 🔄 Token has changed, updating...');
      console.log('[FCM] Syncing token:', {
        old: driverProfile.fcmToken ? driverProfile.fcmToken.slice(0, 20) + '...' : 'empty',
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
        role: 'driver',
        userId: driverProfile.id,
        fcmToken: payload.fcmToken.slice(0, 20) + '...',
        updatedAt: payload.updatedAt,
      });
      
      await firestoreApi.mergeUserFcmToken('driver', driverProfile.id, payload);
      console.log('[FCM] ✓ Firestore updated successfully');

      // Update Redux store
      console.log('[FCM] 📦 Updating Redux store...');
      dispatch(
        updateDriverProfile({
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
  }, [driverProfile, dispatch]);

  /**
   * Listen for FCM token refresh events
   * Firebase automatically refreshes tokens periodically
   */
  useEffect(() => {
    if (!driverProfile) {
      console.log('[FCM] 🚫 No driver profile, skipping refresh listener setup');
      return;
    }

    console.log('[FCM] 👂 Setting up token refresh listener for driver');

    const unsubscribe = messaging().onTokenRefresh((newToken) => {
      console.log('[FCM] 🔄 Firebase triggered token refresh!');
      console.log('[FCM] 📱 New token from Firebase:', newToken.slice(0, 20) + '...');
      syncFcmToken();
    });

    return () => {
      console.log('[FCM] 🛑 Cleaning up token refresh listener');
      unsubscribe();
    };
  }, [driverProfile, syncFcmToken]);

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
   * Initial sync when driver profile is loaded
   */
  useEffect(() => {
    if (!driverProfile) {
      console.log('[FCM] ⏭️  Skipping initial sync - no profile');
      return;
    }

    console.log('[FCM] 🔍 Checking if initial sync needed...');
    console.log('[FCM]    Profile ID:', driverProfile.id);
    console.log('[FCM]    Current fcmToken:', driverProfile.fcmToken === '' ? '⚠️  EMPTY' : '✓ Set');

    if (driverProfile.fcmToken === '') {
      console.log('[FCM] 🚀 Driver profile loaded with empty token, triggering sync...');
      syncFcmToken();
    } else {
      console.log('[FCM] ✓ FCM token already set, skipping initial sync');
    }
  }, [driverProfile?.id, driverProfile?.fcmToken, syncFcmToken]);

  return {
    syncFcmToken,
  };
}
