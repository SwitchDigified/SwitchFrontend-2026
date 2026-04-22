import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // milliseconds, 0 = infinite
}

interface ToastState {
  toasts: Toast[];
}

const initialState: ToastState = {
  toasts: [],
};

export const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    /**
     * Show a toast notification
     * @param message - The message to display
     * @param type - Type of toast: 'success', 'error', or 'info'
     * @param duration - Duration in ms (default: 3000ms for success/info, 4000ms for error)
     */
    showToast: (
      state,
      action: PayloadAction<{
        message: string;
        type: ToastType;
        duration?: number;
      }>
    ) => {
      const { message, type, duration } = action.payload;
      const defaultDuration = type === 'error' ? 4000 : 3000;

      const toast: Toast = {
        id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message,
        type,
        duration: duration ?? defaultDuration,
      };

      console.log('[toastSlice] Adding toast to state:', {
        toastId: toast.id,
        toastType: toast.type,
        toastMessage: toast.message,
        duration: toast.duration,
        totalToasts: state.toasts.length + 1,
      });

      state.toasts.push(toast);
    },

    /**
     * Remove a specific toast by ID
     */
    removeToast: (state, action: PayloadAction<string>) => {
      const toastId = action.payload;
      console.log('[toastSlice] Removing toast:', {
        toastId,
        remainingToasts: state.toasts.length - 1,
      });
      state.toasts = state.toasts.filter(toast => toast.id !== toastId);
    },

    /**
     * Remove all toasts
     */
    clearAllToasts: (state) => {
      state.toasts = [];
    },

    /**
     * Helper: Show success toast
     */
    showSuccess: (
      state,
      action: PayloadAction<{
        message: string;
        duration?: number;
      }>
    ) => {
      const { message, duration } = action.payload;
      const toast: Toast = {
        id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message,
        type: 'success',
        duration: duration ?? 3000,
      };
      console.log('[toastSlice] Adding SUCCESS toast:', {
        toastId: toast.id,
        message: toast.message,
        duration: toast.duration,
        totalToasts: state.toasts.length + 1,
      });
      state.toasts.push(toast);
    },

    /**
     * Helper: Show error toast
     */
    showError: (
      state,
      action: PayloadAction<{
        message: string;
        duration?: number;
      }>
    ) => {
      const { message, duration } = action.payload;
      const toast: Toast = {
        id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message,
        type: 'error',
        duration: duration ?? 4000,
      };
      console.log('[toastSlice] Adding ERROR toast:', {
        toastId: toast.id,
        message: toast.message,
        duration: toast.duration,
        totalToasts: state.toasts.length + 1,
      });
      state.toasts.push(toast);
    },

    /**
     * Helper: Show info toast
     */
    showInfo: (
      state,
      action: PayloadAction<{
        message: string;
        duration?: number;
      }>
    ) => {
      const { message, duration } = action.payload;
      const toast: Toast = {
        id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message,
        type: 'info',
        duration: duration ?? 3000,
      };
      console.log('[toastSlice] Adding INFO toast:', {
        toastId: toast.id,
        message: toast.message,
        duration: toast.duration,
        totalToasts: state.toasts.length + 1,
      });
      state.toasts.push(toast);
    },
  },
});

export const {
  showToast,
  removeToast,
  clearAllToasts,
  showSuccess,
  showError,
  showInfo,
} = toastSlice.actions;

export default toastSlice.reducer;
