import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { removeToast } from '../../store/toastSlice';
import { ToastItem } from './ToastItem';

/**
 * Global Toast Container
 * Should be placed at the root of your app (inside App.tsx)
 * Renders all active toasts with animations
 */
export const ToastContainer = () => {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector(state => state.toast.toasts);



  const handleRemoveToast = (id: string) => {
    dispatch(removeToast(id));
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onRemove={handleRemoveToast}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 12,
    pointerEvents: 'box-none',
  },
});
