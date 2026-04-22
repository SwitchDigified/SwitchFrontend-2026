import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle
} from 'react-native';

import { appColors } from '../../theme/colors';

type BaseBottomSheetProps = {
  visible: boolean;
  onBackdropPress?: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function BaseBottomSheet({
  visible,
  onBackdropPress,
  children,
  contentStyle
}: BaseBottomSheetProps) {
  const translateY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : 24,
        duration: 220,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true
      })
    ]).start();
  }, [opacity, translateY, visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onBackdropPress}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropPress} />
        </Animated.View>
        <Animated.View
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.55)'
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
