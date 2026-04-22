import React, { memo, useState } from 'react';
import { StatusBar, View } from 'react-native';

import { AppButton } from '../../../../components/ui/AppButton';
import { AppText } from '../../../../components/ui/AppText';
import { BackButton } from './BackButton';
import { styles } from '../styles';
import { useAppSelector, useAppDispatch } from '../../../../store/hooks';
import { showError, showSuccess } from '../../../../store/toastSlice';
import { ridesApi } from '../../../../api/apiClient';

type FindingViewProps = {
  avatarLabel: string;
  topInset: number;
  bottomInset: number;
  onBackPress: () => void;
  visible?: boolean;
};

function FindingViewComponent({
  avatarLabel,
  topInset,
  bottomInset,
  onBackPress,
  visible = true,
}: FindingViewProps) {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rideData = useAppSelector((state) => state.ride);
  const authState = useAppSelector((state) => state.auth);
  const sessionUser = authState?.session?.user;
  const activeRideId =
    rideData?.latestRide?.id ??
    (sessionUser && 'activeRideId' in sessionUser ? sessionUser.activeRideId : null);

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
      setIsLoading(true);
      setError(null);
      
      await ridesApi.cancelRide(activeRideId, sessionUser.id, 'passenger');
      
      dispatch(showSuccess({ message: 'Ride cancelled successfully' }));
      // Success - parent component will handle navigation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel ride';
      setError(errorMessage);
      dispatch(showError({ message: errorMessage }));
      console.error('[FindingView] Error canceling ride:', err);
    } finally {
      setIsLoading(false);
    }
  };




  return (
    <View style={[styles.findingScreen, !visible ? styles.hiddenScreen : null]}>
      {visible ? (
        <StatusBar barStyle="light-content" backgroundColor="#003f41" />
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

        <View style={styles.findingProgressRow}>
          <View style={styles.findingProgressSegment} />
          <View style={styles.findingProgressSegment} />
          <View style={styles.findingProgressSegment} />
          <View style={styles.findingProgressSegment} />
        </View>

        <AppText variant="lg" style={styles.findingText}>
          Looking for pilots for you...
        </AppText>

        <View style={styles.findingPulseOuter}>
          <View style={styles.findingPulseInner}>
            <View style={styles.findingPulseCenter} />
          </View>
        </View>

        <AppButton
          title={isLoading ? 'Cancelling...' : 'Cancel Ride'}
          variant="danger"
          onPress={onCancelRide}
          loading={isLoading}
          style={styles.findingCancelButton}
          disabled={isLoading}
        />
      </View>
    </View>
  );
}

export const FindingView = memo(FindingViewComponent);
