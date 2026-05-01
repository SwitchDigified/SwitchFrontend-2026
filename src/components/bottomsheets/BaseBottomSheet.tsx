import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState
} from 'react-native';

import { appColors } from '../../theme/colors';

type BaseBottomSheetProps = {
  visible: boolean;
  onBackdropPress?: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  snapPoints?: number[];
};

export function BaseBottomSheet({
  visible,
  onBackdropPress,
  children,
  contentStyle,
  snapPoints = [0]
}: BaseBottomSheetProps) {
  const translateY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(0);

  // Create PanResponder for drag handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only allow vertical dragging
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Allow dragging down (positive values) but keep it constrained
        const newOffset = Math.max(0, gestureState.dy);
        dragOffset.current = newOffset;
        translateY.setValue(newOffset);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy } = gestureState;
        const closestSnapPoint = snapPoints.reduce((prev, curr) => {
          return (Math.abs(curr - dy) < Math.abs(prev - dy) ? curr : prev);
        });

        Animated.spring(translateY, {
          toValue: closestSnapPoint,
          tension: 80,
          friction: 20,
          useNativeDriver: true
        }).start();
      }
    })
  ).current;

  useEffect(() => {
    if (!visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 24,
          duration: 220,
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true
        })
      ]).start();
    } else {
      // Reset drag offset when opening
      dragOffset.current = 0;
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 20,
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [opacity, translateY, visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onBackdropPress}>
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, { opacity }]} pointerEvents="none">
          <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropPress} />
        </Animated.View>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.sheet,
            contentStyle,
            {
              transform: [{ translateY }]
            }
          ]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    

  },
  backdrop: {
    // ...StyleSheet.absoluteFillObject,
    // backgroundColor: 'rgba(2, 6, 23, 0.55)'
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: appColors.borderDark,
    backgroundColor: appColors.primary,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20
  }
});
