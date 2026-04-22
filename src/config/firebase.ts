import firestore from '@react-native-firebase/firestore';
import NetInfo from '@react-native-community/netinfo';

let isFirestoreConfigured = false;
let isOnline = false;

/**
 * Initialize Firebase Firestore to prevent offline request queuing
 * - Persistence disabled: no local caching
 * - Offline writes disabled: requests fail immediately when offline
 * - Network state monitored separately
 */
const initializeFirestoreSettings = async () => {
  if (isFirestoreConfigured) {
    return;
  }

  try {
    firestore().settings({
      persistence: false,
      cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
    });

    // Disable offline capability - this prevents request queuing
    await firestore().disableNetwork();

    isFirestoreConfigured = true;
    console.log('[Firebase] Firestore configured: no offline queuing');
  } catch (error) {
    console.error('[Firebase] Failed to configure Firestore:', error);
  }
};

/**
 * Monitor network connectivity and enable/disable Firestore accordingly
 */
const setupNetworkMonitoring = async () => {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    const wasOnline = isOnline;
    isOnline = (state.isConnected ?? false) && (state.isInternetReachable ?? false);

    console.log('[Network] Status:', isOnline ? 'ONLINE' : 'OFFLINE');

    try {
      if (isOnline && !wasOnline) {
        // Coming online: re-enable Firestore
        await firestore().enableNetwork();
        console.log('[Firebase] Network enabled');
      } else if (!isOnline && wasOnline) {
        // Going offline: disable Firestore to prevent queuing
        await firestore().disableNetwork();
        console.log('[Firebase] Network disabled');
      }
    } catch (error) {
      console.error('[Firebase] Network state error:', error);
    }
  });

  return unsubscribe;
};

// Initialize on module load
initializeFirestoreSettings();
setupNetworkMonitoring();

// Helper to check if operations are allowed
export const isFirestoreAvailable = (): boolean => {
  return isOnline;
};

// Wrapper for Firestore operations with offline check
export const safeFirestoreOperation = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  if (!isOnline) {
    throw new Error('Firestore operation failed: Device is offline. No requests are queued.');
  }
  return operation();
};

export const db = firestore();