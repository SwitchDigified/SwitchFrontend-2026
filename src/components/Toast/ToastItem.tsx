import React, { useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react-native';
import { appColors } from '../../theme/colors';
import type { ToastType } from '../../store/toastSlice';

const { width } = Dimensions.get('window');

interface ToastItemProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onRemove: (id: string) => void;
}

const getToastConfig = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        backgroundColor: '#10B981',
        icon: CheckCircle,
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
      };
    case 'error':
      return {
        backgroundColor: '#EF4444',
        icon: AlertCircle,
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
      };
    case 'info':
      return {
        backgroundColor: '#3B82F6',
        icon: Info,
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
      };
    default:
      return {
        backgroundColor: appColors.primary,
        icon: Info,
        iconColor: '#FFFFFF',
        textColor: '#FFFFFF',
      };
  }
};

/**
 * Individual toast item with slide-in and fade animations
 */
export const ToastItem = React.forwardRef<Animated.Value, ToastItemProps>(
  ({ id, message, type, duration = 3000, onRemove }, ref) => {
    const slideAnim = useRef(new Animated.Value(width + 100)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const config = getToastConfig(type);
    const IconComponent = config.icon;

    useEffect(() => {
      console.log('[ToastItem] Mounted:', {
        toastId: id,
        toastType: type,
        message,
        duration,
      });

      // Slide in and fade in animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        console.log('[ToastItem] Slide-in animation completed:', id);
      });

      // Auto dismiss after duration
      if (duration > 0) {
        const dismissTimer = setTimeout(() => {
         
          dismissToast();
        }, duration);

        return () => {
          clearTimeout(dismissTimer);
        };
      }

      return () => {
        // console.log('[ToastItem] Unmounting:', id);
      };
    }, []);

    const dismissToast = () => {
      console.log('[ToastItem] Starting dismiss animation:', id);
      // Slide out and fade out animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: width + 100,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        console.log('[ToastItem] Dismiss animation completed, calling onRemove:', id);
        onRemove(id);
      });
    };

    return (
      <Animated.View
        style={[
          styles.toastContainer,
          {
            transform: [{ translateX: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <View
          style={[
            styles.toastContent,
            { backgroundColor: config.backgroundColor },
          ]}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <IconComponent size={20} color={config.iconColor} strokeWidth={2} />
          </View>

          {/* Message */}
          <Text
            style={[styles.message, { color: config.textColor }]}
            numberOfLines={3}
          >
            {message}
          </Text>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={dismissToast}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={18} color={config.textColor} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }
);

ToastItem.displayName = 'ToastItem';

const styles = StyleSheet.create({
  toastContainer: {
    marginHorizontal: 12,
    marginVertical: 6,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    marginRight: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});
