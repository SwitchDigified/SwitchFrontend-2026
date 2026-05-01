import React, { memo, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';

import { AppButton } from '../../../../components/ui/AppButton';
import { AppText } from '../../../../components/ui/AppText';
import { BackButton } from './BackButton';
import { styles } from '../styles';
import { useAppSelector, useAppDispatch } from '../../../../store/hooks';
import { showError, showSuccess } from '../../../../store/toastSlice';
import { ridesApi } from '../../../../api/apiClient';
import { createRideRequest } from '../../../../store/rideSlice';

type NoDriverAvailableScreenProps = {
  avatarLabel: string;
  topInset: number;
  bottomInset: number;
  onBackPress: () => void;
  visible?: boolean;
};

function NoDriverAvailableScreenComponent({
  avatarLabel,
  topInset,
  bottomInset,
  onBackPress,
  visible = true,
}: NoDriverAvailableScreenProps) {
  const dispatch = useAppDispatch();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rideData = useAppSelector((state) => state.ride);
  const authState = useAppSelector((state) => state.auth);
  const sessionUser = authState?.session?.user;
  const activeRideId =
    rideData?.latestRide?.id ??
    (sessionUser && 'activeRideId' in sessionUser ? sessionUser.activeRideId : null);
  const paymentMethod = rideData?.latestRide?.paymentMethod ?? 'cash';

  const onCancelRide = async () => {
    // Validate required data
    if (!activeRideId) {
      dispatch(showError({ message: 'No active ride found to cancel' }));
      return;
    }

    if (!sessionUser?.id) {
      dispatch(showError({ message: 'User not authenticated' }));
      return;
    }

    try {
      setIsCancelling(true);
      setError(null);

      await ridesApi.cancelRide(activeRideId, sessionUser.id, 'passenger');

      dispatch(showSuccess({ message: 'Ride cancelled successfully' }));
      onBackPress();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel ride';
      setError(errorMessage);
      dispatch(showError({ message: errorMessage }));
      console.error('[NoDriverAvailableScreen] Error canceling ride:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const onRetryRideRequest = async () => {
    // Validate required data
    if (!sessionUser?.id) {
      dispatch(showError({ message: 'User not authenticated' }));
      return;
    }

    try {
      setIsRetrying(true);
      setError(null);

      // First cancel the exhausted ride
      if (activeRideId) {
        await ridesApi.cancelRide(activeRideId, sessionUser.id, 'passenger');
      }

      // Then create a new ride request with the same locations from Redux state
      const result = await dispatch(
        createRideRequest({
          paymentMethod,
        }),
      );

      if (result.type === createRideRequest.fulfilled.type) {
        dispatch(showSuccess({ message: 'Ride request created! Looking for drivers...' }));
      } else {
        throw new Error('Failed to create ride request');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry ride request';
      setError(errorMessage);
      dispatch(showError({ message: errorMessage }));
      console.error('[NoDriverAvailableScreen] Error retrying ride:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <View style={[styles.findingScreen, !visible ? styles.hiddenScreen : null]}>
      {visible ? (
        <StatusBar barStyle="light-content" backgroundColor="#05080d" />
      ) : null}

      <View style={[styles.findingTopBar, { paddingTop: topInset + 8 }]}>
        <BackButton onPress={onBackPress} />
        <View />
        <View />
      </View>

      <View
        style={[
          styles.findingContent,
          {
            paddingTop: topInset + 24,
            paddingBottom: bottomInset + 24,
          },
        ]}
      >
        <View style={styles.findingAvatarRing}>
          <View style={styles.findingAvatarCore}>
            <AppText variant="xl" style={styles.findingAvatarLabel}>
              {avatarLabel}
            </AppText>
          </View>
        </View>

        {/* Alert icon */}
        <View style={{ marginVertical: 16, alignItems: 'center' }}>
          <AlertCircle size={48} color="#ff6b6b" strokeWidth={1.5} />
        </View>

        <AppText variant="lg" style={[styles.findingText, { marginBottom: 8 }]}>
          No Drivers Available
        </AppText>

        <AppText
          variant="sm"
          style={[
            styles.findingText,
            { color: '#999999', marginBottom: 24, textAlign: 'center' },
          ]}
        >
          We couldn't find any drivers in your area at this time. Please try again later or
          cancel this request.
        </AppText>

        {error && (
          <AppText variant="xs" style={{ color: '#ff6b6b', marginBottom: 16, textAlign: 'center' }}>
            {error}
          </AppText>
        )}

        <View style={{ gap: 12 }}>
          <AppButton
            title={isRetrying ? 'Requesting Again...' : 'Request Again'}
            variant="primary"
            onPress={onRetryRideRequest}
            loading={isRetrying}
            disabled={isRetrying || isCancelling}
          />

          <AppButton
            title={isCancelling ? 'Cancelling...' : 'Cancel Ride'}
            variant="danger"
            onPress={onCancelRide}
            loading={isCancelling}
            disabled={isCancelling || isRetrying}
          />
        </View>
      </View>
    </View>
  );
}

export const NoDriverAvailableScreen = memo(NoDriverAvailableScreenComponent);
