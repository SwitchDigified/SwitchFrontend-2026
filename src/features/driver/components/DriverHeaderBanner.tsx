import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Menu, Navigation, X } from 'lucide-react-native';

import { AppText } from '../../../components/ui/AppText';

type DriverHeaderBannerProps = {
  top: number;
  hasRideRequest: boolean;
  rideRequestExpiresAt?: string | null;
  onOpenDrawer: () => void;
  onCancelRideRequest: () => void;
  showAcceptedRideBanner?: boolean;
  acceptedDistanceText?: string;
  acceptedEtaText?: string;
  onNavigateToPickup: () => void;
  showOnTripBanner?: boolean;
  onTripDistanceText?: string;
  onTripEtaText?: string;
  onNavigateToDestination: () => void;
  statsValue: string;
  statsLabel: string;
  profilePhotoUrl?: string | null;
  initials: string;
};

const DEFAULT_REQUEST_SECONDS = 30;

const getRemainingSeconds = (expiresAt?: string | null): number => {
  if (!expiresAt) return DEFAULT_REQUEST_SECONDS;

  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return DEFAULT_REQUEST_SECONDS;

  const remainingSeconds = Math.ceil((expiresAtMs - Date.now()) / 1000);
  return Math.max(0, remainingSeconds);
};

export function DriverHeaderBanner({
  top,
  hasRideRequest,
  rideRequestExpiresAt,
  onOpenDrawer,
  onCancelRideRequest,
  showAcceptedRideBanner = false,
  acceptedDistanceText = '0 km',
  acceptedEtaText = '0 min',
  onNavigateToPickup,
  showOnTripBanner = false,
  onTripDistanceText = '0 km',
  onTripEtaText = '0 min',
  onNavigateToDestination,
  statsValue,
  statsLabel,
  profilePhotoUrl,
  initials,
}: DriverHeaderBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    getRemainingSeconds(rideRequestExpiresAt)
  );

  useEffect(() => {
    if (!hasRideRequest) {
      return;
    }

    setSecondsLeft(getRemainingSeconds(rideRequestExpiresAt));
    const interval = setInterval(() => {
      setSecondsLeft(getRemainingSeconds(rideRequestExpiresAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [hasRideRequest, rideRequestExpiresAt]);

  const timeLeftLabel = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes}.${String(seconds).padStart(2, '0')} sec left`;
  }, [secondsLeft]);

  if (showAcceptedRideBanner) {
    return (
      <View style={[styles.acceptedBanner, { top }]}>
        <View>
          <AppText variant="label" style={styles.requestTitle}>
            Go to pickup location
          </AppText>
          <AppText variant="caption" style={styles.requestSubtitle}>
            {acceptedDistanceText} ({acceptedEtaText})
          </AppText>
        </View>

        <Pressable
          onPress={onNavigateToPickup}
          style={({ pressed }) => [
            styles.navigateButton,
            pressed ? styles.buttonPressed : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Navigate to pickup"
        >
          <AppText variant="label" style={styles.cancelText}>
            NAVIGATE
          </AppText>
          <Navigation size={16} color="#f1f5f9" />
        </Pressable>
      </View>
    );
  }

  if (showOnTripBanner) {
    return (
      <View style={[styles.acceptedBanner, { top }]}>
        <View>
          <AppText variant="label" style={styles.requestTitle}>
            Heading to destination
          </AppText>
          <AppText variant="caption" style={styles.requestSubtitle}>
            {onTripDistanceText} ({onTripEtaText})
          </AppText>
        </View>

        <Pressable
          onPress={onNavigateToDestination}
          style={({ pressed }) => [
            styles.navigateButton,
            pressed ? styles.buttonPressed : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Navigate to destination"
        >
          <AppText variant="label" style={styles.cancelText}>
            NAVIGATE
          </AppText>
          <Navigation size={16} color="#f1f5f9" />
        </Pressable>
      </View>
    );
  }

  if (hasRideRequest) {
    return (
      <View style={[styles.requestBanner, { top }]}>
        <View>
          <AppText variant="label" style={styles.requestTitle}>
            Ride request received
          </AppText>
          <AppText variant="caption" style={styles.requestSubtitle}>
            {timeLeftLabel}
          </AppText>
        </View>

        <Pressable
          onPress={onCancelRideRequest}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed ? styles.buttonPressed : undefined,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cancel ride request"
        >
          <AppText variant="label" style={styles.cancelText}>
            Cancel
          </AppText>
          <X size={16} color="#f1f5f9" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.defaultBanner, { top }]}>
      <Pressable
        onPress={onOpenDrawer}
        style={({ pressed }) => [
          styles.menuButton,
          pressed ? styles.buttonPressed : undefined,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
      >
        <Menu color="#e2e8f0" size={20} />
      </Pressable>

      <View style={styles.statsPill}>
        <AppText variant="label" style={styles.statsValue}>
          {statsValue}
        </AppText>
        <AppText variant="caption" style={styles.statsLabel}>
          {statsLabel}
        </AppText>
      </View>

      {profilePhotoUrl ? (
        <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <View style={styles.avatarWrap}>
          <AppText variant="label" style={styles.avatarText}>
            {initials}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  defaultBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(56, 189, 248, 0.65)',
    borderBottomColor: 'rgba(56, 189, 248, 0.65)',
    backgroundColor: 'rgba(7, 18, 28, 0.78)',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  menuButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(9, 30, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  statsValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statsLabel: {
    marginTop: 1,
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0b1a25',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.5)',
    backgroundColor: '#0b1a25',
  },
  avatarText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '800',
  },
  requestBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(56, 189, 248, 0.65)',
    borderBottomColor: 'rgba(56, 189, 248, 0.65)',
    backgroundColor: 'rgba(7, 18, 28, 0.82)',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  acceptedBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(56, 189, 248, 0.65)',
    borderBottomColor: 'rgba(56, 189, 248, 0.65)',
    backgroundColor: 'rgba(7, 18, 28, 0.82)',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  requestTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  requestSubtitle: {
    marginTop: 2,
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(8, 47, 73, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  navigateButton: {
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(8, 47, 73, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
