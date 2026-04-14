import React, { useRef } from 'react';
import { Animated, Dimensions, PanResponder, StatusBar, View } from 'react-native';
import type { Region } from 'react-native-maps';

import { PassengerMap } from '../../../../components/maps';
import { AppText } from '../../../../components/ui/AppText';
import type { RideLocation } from '../../../../types/ride';
import { BackButton } from './BackButton';
import { styles } from '../styles';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Snap points as fractions of screen height (sheet height)
const SNAP_LARGE = SCREEN_HEIGHT * 0.82; // ~82% — default expanded
const SNAP_MEDIUM = SCREEN_HEIGHT * 0.20; // 20%
const SNAP_SMALL = SCREEN_HEIGHT * 0.10; // 10%

function snapTo(value: number): number {
  const snaps = [SNAP_SMALL, SNAP_MEDIUM, SNAP_LARGE];
  return snaps.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
  );
}

type PlannerLayoutProps = {
  title: string;
  avatarLabel: string;
  mapRegion: Region;
  pickupLocation: RideLocation | null;
  stopLocation: RideLocation | null;
  destinationLocation: RideLocation | null;
  showPolyline?: boolean;
  topInset: number;
  bottomInset: number;
  isVehicleScreen: boolean;
  onBackPress: () => void;
  children: React.ReactNode;
};

export function PlannerLayout({
  title,
  avatarLabel,
  mapRegion,
  pickupLocation,
  stopLocation,
  destinationLocation,
  showPolyline = false,
  topInset,
  bottomInset,
  isVehicleScreen,
  onBackPress,
  children,
}: PlannerLayoutProps) {
  const sheetHeight = useRef(new Animated.Value(SNAP_LARGE)).current;
  const lastHeight = useRef(SNAP_LARGE);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 4,

      onPanResponderMove: (_, gestureState) => {
        // dy > 0 = dragging down (shrink), dy < 0 = dragging up (grow)
        const next = Math.max(
          SNAP_SMALL,
          Math.min(SNAP_LARGE, lastHeight.current - gestureState.dy),
        );
        sheetHeight.setValue(next);
      },

      onPanResponderRelease: (_, gestureState) => {
        const projected = lastHeight.current - gestureState.dy;
        const snapped = snapTo(projected);
        lastHeight.current = snapped;

        Animated.spring(sheetHeight, {
          toValue: snapped,
          useNativeDriver: false,
          bounciness: 4,
        }).start();
      },
    }),
  ).current;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#05080d" />

      <PassengerMap
        mapRegion={mapRegion}
        pickupLocation={pickupLocation}
        stopLocation={stopLocation}
        destinationLocation={destinationLocation}
        showPassengerPin={true}
        showPolyline={showPolyline}
        style={styles.map}
      />

      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        <BackButton onPress={onBackPress} />

        <View style={styles.planPill}>
          <AppText variant="label" style={styles.planPillText}>
            {title}
          </AppText>
        </View>

        <View style={styles.avatarWrap}>
          <AppText variant="xs" style={styles.avatarText}>
            {avatarLabel}
          </AppText>
          <View style={styles.avatarDot} />
        </View>
      </View>

      {/* Draggable bottom sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          isVehicleScreen ? styles.bottomSheetVehicle : undefined,
          {
            paddingBottom: Math.max(16, bottomInset + 8),
            // Override position: use height instead of maxHeight so drag works
            height: sheetHeight,
            maxHeight: undefined,
          },
        ]}
      >
        {/* Drag handle — only this area triggers the pan */}
        <View {...panResponder.panHandlers} style={styles.dragHandleZone}>
          <View style={styles.sheetHandle} />
        </View>

        {/* Scrollable content inside the sheet */}
        <View style={{ flex: 1, overflow: 'hidden' }}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}