import NetInfo from '@react-native-community/netinfo';
import firestore from '@react-native-firebase/firestore';

/**
 * Network connectivity state management
 * Tracks whether the device has internet connectivity
 */

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

let networkState: NetworkState = {
  isConnected: false,
  isInternetReachable: false,
  type: 'unknown',
};

const networkListeners: Set<(state: NetworkState) => void> = new Set();

/**
 * Initialize network monitoring
 * Must be called once in app initialization
 */
export const initializeNetworkMonitoring = () => {
  console.log('[Network] Initializing network monitoring');

  // Subscribe to network state changes
  const unsubscribe = NetInfo.addEventListener(state => {
    const newNetworkState: NetworkState = {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type ?? 'unknown',
    };

    console.log('[Network] State changed:', {
      isConnected: newNetworkState.isConnected,
      isInternetReachable: newNetworkState.isInternetReachable,
      type: newNetworkState.type,
    });

    networkState = newNetworkState;

    // Notify all listeners
    networkListeners.forEach(listener => listener(newNetworkState));

    // Enable/disable Firestore network based on connectivity
    if (newNetworkState.isConnected && newNetworkState.isInternetReachable) {
      console.log('[Network] Internet available - enabling Firestore network');
      firestore().enableNetwork().catch(err => {
        console.error('[Network] Error enabling Firestore network:', err);
      });
    } else {
      console.warn('[Network] No internet - disabling Firestore network');
      firestore().disableNetwork().catch(err => {
        console.error('[Network] Error disabling Firestore network:', err);
      });
    }
  });

  return unsubscribe;
};

/**
 * Get current network state
 */
export const getNetworkState = (): NetworkState => {
  return { ...networkState };
};

/**
 * Check if device is online
 */
export const isOnline = (): boolean => {
  return networkState.isConnected && networkState.isInternetReachable;
};

/**
 * Subscribe to network state changes
 * @returns Unsubscribe function
 */
export const subscribeToNetworkState = (
  callback: (state: NetworkState) => void
): (() => void) => {
  networkListeners.add(callback);

  return () => {
    networkListeners.delete(callback);
  };
};

/**
 * Wait until internet is available (blocks until online)
 * Useful for critical operations that require network
 */
export const waitUntilOnline = async (timeoutMs: number = 30000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isOnline()) {
      console.log('[Network] Already online');
      resolve(true);
      return;
    }

    console.log('[Network] Waiting for internet connection...');

    let timeoutId: NodeJS.Timeout | null = null;
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unsubscribe) unsubscribe();
    };

    timeoutId = setTimeout(() => {
      console.warn('[Network] Timeout waiting for internet connection');
      cleanup();
      resolve(false);
    }, timeoutMs);

    unsubscribe = subscribeToNetworkState((state) => {
      if (state.isConnected && state.isInternetReachable) {
        console.log('[Network] Internet connection restored');
        cleanup();
        resolve(true);
      }
    });
  });
};
