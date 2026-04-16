import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StatusBar,
  Text,
  View,
} from 'react-native';
import type { Region } from 'react-native-maps';

import { PassengerMap } from '../../../../components/maps';
import { AppText } from '../../../../components/ui/AppText';
import type { RideLocation } from '../../../../types/ride';
import type { FlowScreen } from '../types';
import { BackButton } from './BackButton';
import { styles } from '../styles';
import { BottomSheet1, BottomSheet2, BottomSheet3 } from './planner_sheets';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Snap points as fractions of screen height (sheet height)
const SNAP_LARGE = SCREEN_HEIGHT * 0.82; // ~82% — default expanded
const SNAP_MEDIUM = SCREEN_HEIGHT * 0.2; // 20%
const SNAP_SMALL = SCREEN_HEIGHT * 0.1; // 10%

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
  currentScreen: FlowScreen;
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
  currentScreen,
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
        edgePadding={{
          top: 50,
          right: 40,
          bottom: 400,
          left: 40,
        }}
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

      {/* Draggable bottom sheet - conditionally rendered based on current screen */}
      {(currentScreen === 'plan' || currentScreen === 'home') && (
          <BottomSheet2
          visible={true}
          onClose={() => {}}
          height={430}
          snapPoints={[0, 200]} // 0=fully open, 200=mid, 500=nearly closed
        >
          {children}
        </BottomSheet2>
        
      )}

      {currentScreen === 'route' && (
        <BottomSheet2
          visible={true}
          onClose={() => {}}
          height={560}
          snapPoints={[0, 200, 300]} // 0=fully open, 200=mid, 500=nearly closed
        >
          {children}
        </BottomSheet2>
      )}

      {(currentScreen === 'vehicle' ||
        currentScreen === 'finding' ||
        currentScreen === 'arrived' ||
        currentScreen === 'en_route') && (
       <BottomSheet2
          visible={true}
          onClose={() => {}}
          height={700}
          snapPoints={[0, 480]} // 0=fully open, 200=mid, 500=nearly closed
        >
          {children}
        </BottomSheet2>
      )}
    </View>
  );
}
