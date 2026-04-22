import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Menu, Shield, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

import { AppText } from '../../../components/ui/AppText';
import { DriverRideMap } from '../../../components/maps';
import { GOOGLE_MAPS_DIRECTIONS_API_KEY } from '../../../config/api';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { logout } from '../../../store/authSlice';
import { setDriverId, setDriverOnlineState, setDriverAvailableState } from '../../../store/driverLocationSlice';
import type { DriverUser } from '../../../types/auth';
import { DriverDrawer } from '../components/DriverDrawer';
import { DUMMY_DESTINATION, DUMMY_DRIVER_LOCATION, DUMMY_PICKUP_LOCATION, RideStatus, UberMap } from '../map';
import { useLocationTracking } from '../../../hooks/Uselocationtracking';
import { useFcmTokenSync } from '../hooks/useFcmTokenSync';
import { syncDriverPresence, setDriverOfflineState, toggleDriverOnlineStatus } from '../../../services/driverLocationService';
import { listenToDriverLocation } from '../../../listeners/driverLocationListener';

type DriverHomeScreenProps = {
  onNavigateToProfileSetup?: () => void;
};

const isDriverProfileComplete = (driver: DriverUser | null): boolean => {
  if (!driver) {
    return false;
  }

  return Boolean(driver.basicProfile && driver.vehicleDetails && driver.preference);
};

export function DriverHomeScreen({ onNavigateToProfileSetup }: DriverHomeScreenProps) {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const bottomTrayPaddingBottom = Math.max(12, insets.bottom + 8);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showProfileSetupModal, setShowProfileSetupModal] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);
  const [rideRequest, setRideRequest] = useState<any>(null);

  const driverData = useAppSelector((state) => state.auth.session?.user ?? null);
  const currentRide = useAppSelector((state) => state.driverCurrentRide.currentRide);
  const driverLocationState = useAppSelector((state) => state.driverLocation);

  const driverProfile = useMemo(() => {
    if (!driverData || driverData.role !== 'driver') {
      return null;
    }
    return driverData;
  }, [driverData]);

  const needsProfileSetup = useMemo(() => {
    if (!driverProfile) {
      return false;
    }
    return !isDriverProfileComplete(driverProfile);
  }, [driverProfile]);

  // Initialize FCM token sync on app/screen mount
  useFcmTokenSync();

  // Initialize driver ID in Redux on mount
  React.useEffect(() => {
    if (driverProfile?.id && driverProfile.id !== driverLocationState.driverId) {
      dispatch(setDriverId(driverProfile.id));
    }
  }, [driverProfile?.id, driverLocationState.driverId, dispatch]);

  // Set up real-time Firestore listener for driver location changes
  React.useEffect(() => {
    if (!driverLocationState.driverId) {
      console.log('[DriverHomeScreen] Skipping listener setup - no driverId in Redux yet');
      return;
    }

    console.log('[DriverHomeScreen] Setting up driver location listener:', driverLocationState.driverId);

    const unsubscribe = listenToDriverLocation(
      driverLocationState.driverId,
      dispatch,
      (error) => {
        console.error('[DriverHomeScreen] Listener error:', {
          driverId: driverLocationState.driverId,
          message: error.message,
        });
      }
    );

    // Cleanup: unsubscribe from listener when component unmounts or driverId changes
    return () => {
      console.log('[DriverHomeScreen] Cleaning up driver location listener');
      unsubscribe();
    };
  }, [driverLocationState.driverId, dispatch]);

  // Calculate driver initials
  const initials = useMemo(() => {
    if (!driverProfile) return 'DR';
    const first = driverProfile.firstName?.[0] ?? '';
    const last = driverProfile.lastName?.[0] ?? '';
    const value = `${first}${last}`.toUpperCase();
    return value.length > 0 ? value : 'DR';
  }, [driverProfile]);

  // Use location tracking hook
  const driverLocation = useLocationTracking({
    driverId: driverProfile?.id,
    isOnline: driverLocationState.isOnline,
    isAvailable: driverLocationState.isAvailable,
    activeRideId: driverLocationState.activeRideId,
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    distanceThreshold: 2,
    onLocationChange: (state) => {
      if (state.coords && state.geohash) {
        console.log(`Location updated: ${state.geohash}`);
        console.log(`Accuracy: ${state.coords.accuracy}m`);
      }
    },
    onError: (error) => {
      console.error('Location error:', error.code, error.message);
    }
  });

  // Automatically start/stop location tracking based on online status
  React.useEffect(() => {
    console.log('[DriverHomeScreen] Online status changed:', driverLocationState.isOnline);
    
    if (driverLocationState.isOnline) {
      console.log('[DriverHomeScreen] Driver is online - starting location tracking');
      driverLocation.startTracking();
    } else {
      console.log('[DriverHomeScreen] Driver is offline - stopping location tracking');
      driverLocation.stopTracking();
    }
  }, [driverLocationState.isOnline, driverLocation]);

  const drawerName = driverProfile ? `${driverProfile.firstName} ${driverProfile.lastName}`.trim() : 'Driver';
  const drawerPhone = driverProfile?.phone ?? '';
  const drawerProfilePhoto = driverProfile?.basicProfile?.profilePhotoUrl ?? null;

  

  const onToggleRideRequestPreview = useCallback(() => {
    if (!driverLocationState.isOnline) return;
    setRideRequest((current: any) => (current ? null : { pickupLocation: { latitude: 9.05785, longitude: 7.49508 }, destinationLocation: { latitude: 9.04104, longitude: 7.48948 } }));
  }, [driverLocationState.isOnline]);

  const onLogout = useCallback(async () => {
    console.log('[DriverHomeScreen] Logging out');
    
    if (driverProfile?.id && driverLocationState.isOnline) {
      try {
        console.log('[DriverHomeScreen] Setting driver offline on logout');
        // Sync offline state to Firestore
        await setDriverOfflineState(driverProfile.id, driverLocationState.currentLocation ?? undefined);
      } catch (error) {
        console.error('[DriverHomeScreen] Error setting driver offline on logout:', error);
      }
    }
    
    // Update Redux state (useEffect will auto-stop tracking when isOnline becomes false)
    dispatch(setDriverOnlineState(false));
    dispatch(setDriverAvailableState(false));
    setRideRequest(null);
    dispatch(logout());
  }, [driverProfile?.id, driverLocationState.isOnline, driverLocationState.currentLocation, dispatch]);

  
  // Derive ride status from actual currentRide data
  const rideStatus = useMemo(() => {
    if (!currentRide) {
      return 'incoming_request' as RideStatus;
    }
    const statusMap: Record<string, RideStatus> = {
      'requested': 'incoming_request',
      'accepted': 'accepted',
      'arrived': 'on_trip',
      'on_trip': 'on_trip',
      'completed': 'completed',
      'cancelled': 'completed',
      'idle': 'incoming_request'
    };
    return (statusMap[currentRide.status] || 'incoming_request') as RideStatus;
  }, [currentRide?.status]);

  if (!driverData) {
    return null;
  }

  console.log('[DriverHomeScreen] Render state:', {
    isTracking: driverLocation.isTracking,
    driverCoords: driverLocation.coords ? { lat: driverLocation.coords.latitude, lng: driverLocation.coords.longitude } : null,
    isOnline: driverLocationState.isOnline,
    isAvailable: driverLocationState.isAvailable,
    activeRideId: driverLocationState.activeRideId,
    currentRide: currentRide?.id,
    error: driverLocation.error?.message
  });
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1117" />
      {/* <View style={styles.mapWrapper}> */}
        {driverLocation.coords && currentRide?.pickupCoordinates && currentRide?.destinationCoordinates ? (
          <UberMap
            driverLocation={{
              latitude: driverLocation.coords.latitude,
              longitude: driverLocation.coords.longitude
            }}
            pickupLocation={currentRide.pickupCoordinates}
            destination={currentRide.destinationCoordinates}
            rideStatus={rideStatus}
          />
        ) : (
          <MapView
            style={styles.fallbackMapContainer}
            initialRegion={{
              latitude: 9.0765,
              longitude: 7.3986,
              latitudeDelta: 8,
              longitudeDelta: 8,
            }}
          >
            <Marker
              coordinate={{ latitude: 9.0765, longitude: 7.3986 }}
              title="Nigeria"
            />
          </MapView>
        )}
      {/* </View> */}

 

      <View style={[styles.topRow, { top: insets.top + 8 }]}>
        <Pressable
          onPress={() => setIsDrawerOpen(true)}
          style={({ pressed }) => [
            styles.roundButton,
            pressed ? styles.buttonPressed : undefined
          ]}>State
          <Menu color="#e2e8f0" size={20} />
        </Pressable>

        <View style={styles.statsPill}>
          <AppText variant="label" style={styles.statsValue}>
            12 RIDES | N191,700
          </AppText>
          <AppText variant="caption" style={styles.statsLabel}>
            {rideRequest ? 'Incoming request' : driverLocationState.isTracking ? 'Live tracking' : 'Today'}
          </AppText>
        </View>

        <View style={styles.avatarWrap}>
          <AppText variant="label" style={styles.avatarText}>
            {initials}
          </AppText>
        </View>
      </View>

      <Pressable
        onPress={onToggleRideRequestPreview}
        disabled={!driverLocationState.isOnline}
        style={({ pressed }) => [
          styles.securityFab,
          !driverLocationState.isOnline ? styles.roundButtonDisabled : undefined,
          pressed ? styles.buttonPressed : undefined
        ]}>
        <Shield color="#1de9b6" size={18} />
      </Pressable>

      <View style={styles.onlineButtonWrap}>
        <Pressable
          onPress={async () => {
            if (!driverProfile?.id) return;
            setIsTogglingOnline(true);
            try {
              const newOnlineState = !driverLocationState.isOnline;
              
              console.log('[DriverHomeScreen] Toggling online status:', {
                currentState: driverLocationState.isOnline,
                newState: newOnlineState,
                driverId: driverProfile.id
              });

              // Update Redux state immediately (this triggers the useEffect to start/stop tracking)
              dispatch(setDriverOnlineState(newOnlineState));
              dispatch(setDriverAvailableState(newOnlineState));
              
              // Sync to Firestore
              await toggleDriverOnlineStatus(driverProfile.id, newOnlineState);
              
              console.log('[DriverHomeScreen] Successfully toggled online status to:', newOnlineState);
            } catch (error) {
              console.error('[DriverHomeScreen] Error toggling online status:', error);
              // Revert on error
              dispatch(setDriverOnlineState(driverLocationState.isOnline));
              dispatch(setDriverAvailableState(driverLocationState.isAvailable));
            } finally {
              setIsTogglingOnline(false);
            }
          }}
          style={({ pressed }) => [
            styles.onlineButton,
            driverLocationState.isOnline ? styles.onlineButtonActive : undefined,
            isTogglingOnline ? styles.onlineButtonLoading : undefined,
            pressed ? styles.buttonPressed : undefined
          ]}>
          {isTogglingOnline ? (
            <ActivityIndicator color="#f8fafc" size="large" />
          ) : (
            <AppText variant="button" style={styles.onlineButtonText}>
              {driverLocationState.isOnline ? 'GO OFFLINE!' : 'GO ONLINE!'}
            </AppText>
          )}
        </Pressable>
      </View>

      <View style={[styles.bottomTray, { paddingBottom: bottomTrayPaddingBottom }]}>
        <View style={styles.statusRow}>
          <AppText variant="label" style={styles.statusText}>
            {driverLocationState.isOnline ? "YOU'RE ONLINE!" : "YOU'RE OFFLINE!"}
          </AppText>
          <View style={[styles.statusDot, driverLocationState.isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
        </View>
      </View>

      <Modal transparent animationType="fade" visible={showProfileSetupModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Pressable
              onPress={() => setShowProfileSetupModal(false)}
              style={({ pressed }) => [
                styles.modalCloseButton,
                pressed ? styles.buttonPressed : undefined
              ]}>
              <X color="#cbd5e1" size={18} />
            </Pressable>
            <AppText variant="label" style={styles.modalTitle}>
              Complete your driver profile
            </AppText>
            <AppText variant="body" style={styles.modalBody}>
              Your driver information and earning preference are not complete yet. Finish setup before going online.
            </AppText>
            <Pressable
              onPress={() => {
                setShowProfileSetupModal(false);
                onNavigateToProfileSetup?.();
              }}
              disabled={!onNavigateToProfileSetup}
              style={({ pressed }) => [
                styles.modalButton,
                !onNavigateToProfileSetup ? styles.roundButtonDisabled : undefined,
                pressed ? styles.buttonPressed : undefined
              ]}>
              <AppText variant="button" style={styles.modalButtonText}>
                Go to Profile Setup
              </AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <DriverDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        driverName={drawerName}
        driverPhone={drawerPhone}
        profilePhotoUrl={drawerProfilePhoto}
        onOpenProfile={() => {
          setIsDrawerOpen(false);
          onNavigateToProfileSetup?.();
        }}
        onLogout={() => {
          setIsDrawerOpen(false);
          onLogout();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: '#071521',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.26)',
    padding: 18,
    gap: 10
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)'
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 17
  },
  modalBody: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20
  },
  modalButton: {
    marginTop: 6,
    borderRadius: 14,
    minHeight: 46,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.45)',
    backgroundColor: 'rgba(6, 78, 59, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  modalButtonText: {
    color: '#f8fafc'
  },
  screen: {
    flex: 1,
    backgroundColor: '#0a1117'
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0
  },
  topRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(11, 22, 31, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  roundButtonDisabled: {
    opacity: 0.45
  },
  statsPill: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(11, 22, 31, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  statsValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  statsLabel: {
    marginTop: 2,
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0b1a25',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '800'
  },
  securityFab: {
    position: 'absolute',
    right: 20,
    top: 150,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 22, 31, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)'
  },
  onlineButtonWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 86,
    alignItems: 'center'
  },
  onlineButton: {
    width: 100,
    height: 100,
    borderRadius: 63,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.45)',
    backgroundColor: 'rgba(6, 66, 70, 0.86)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  onlineButtonActive: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(120, 22, 22, 0.82)'
  },
  onlineButtonText: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center'
  },
  onlineButtonLoading: {
    opacity: 0.7
  },
  bottomTray: {
    marginTop: 'auto',
    backgroundColor: 'rgba(1, 40, 51, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.28)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  statusText: {
    color: '#f8fafc',
    letterSpacing: 0.3
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3
  },
  statusDotOnline: {
    backgroundColor: '#22c55e'
  },
  statusDotOffline: {
    backgroundColor: '#ef4444'
  },
  bottomInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  modeText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  logoutButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)'
  },
  buttonPressed: {
    opacity: 0.85
  },
  mapWrapper: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#DDE3EA',
  },
  fallbackMapContainer: {
    flex: 1,
    backgroundColor: '#1a3a4a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  fallbackMapText: {
    color: '#cbd5e1',
    fontSize: 24,
    fontWeight: '600',
  },
});
