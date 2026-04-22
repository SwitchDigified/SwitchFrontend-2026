import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { usePassengerHomeState } from '../hooks/usePassengerHomeState';
import { usePassengerLocationTracking } from '../hooks/usePassengerLocationTracking';
import { useFcmTokenSync } from '../hooks/useFcmTokenSync';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  cancelRideRequest,
  clearRideError,
  setDestinationLocation,
  setPickupLocation,
  setRideType,
  setScheduleType,
  setStopLocation,
  setRide,
} from '../../../store/rideSlice';
import { listenToActivePassengerRide } from '../../../listeners';
import { AppText } from '../../../components/ui/AppText';
import { LoadingOverlay } from '../../../components/ui/LoadingOverlay';
import { appColors } from '../../../theme/colors';
import type {
  RideLocation,
  RideMatchingData,
  RideStatus,
  RideType,
} from '../../../types/ride';
import { DEFAULT_REGION } from '../passengerHome/constants';
import { FindingView } from '../passengerHome/components/FindingView';
import { DriverArriveScreen } from '../passengerHome/components/DriverArriveScreen';
import { EnRouteScreen } from '../passengerHome/components/EnRouteScreen';
import { HomeView } from '../passengerHome/components/HomeView';
import { PlannerLayout } from '../passengerHome/components/PlannerLayout';
import { PlanView } from '../passengerHome/components/PlanView';
import { RouteView } from '../passengerHome/components/RouteView';
import { VehicleView } from '../passengerHome/components/VehicleView';
import type { FlowScreen } from '../passengerHome/types';
import { getScreenTitle, toInitials } from '../passengerHome/utils';
import { PassengerDrawer } from '../components/PassengerDrawer';

const getScreenBasedOnRideStatus = (
  rideStatus?: RideStatus | 'idle',
): FlowScreen => {
  switch (rideStatus) {
    case 'requested':
      return 'finding';
    case 'accepted':
      return 'accepted';
    case 'arrived':
      return 'arrived';
    case 'on_trip':
      return 'on_trip';
    default:
      return 'plan';
  }
};

export function PassengerHomeScreen() {
  const riderData = useAppSelector(s=>s.passengerProfile
)
  console.log("rideerData", riderData)
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { session, onLogout } = usePassengerHomeState();
  const {
    pickupLocation,
    stopLocation,
    destinationLocation,
    rideType,
    scheduleType,
    requestStatus,
    cancelStatus,
    error,
    latestRide,
    rideStatus,
  } = useAppSelector(state => state.ride);
  // console.log('Latest Ride:', latestRide);

  // Initialize passenger location tracking on app/screen mount
  usePassengerLocationTracking();

  // Initialize FCM token sync on app/screen mount
  useFcmTokenSync();

  const [screen, setScreen] = useState<FlowScreen>('home');
  const [pickupInputValue, setPickupInputValue] = useState(
    pickupLocation?.address ?? '',
  );
  const [destinationInputValue, setDestinationInputValue] = useState(
    destinationLocation?.address ?? '',
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [showStopPicker, setShowStopPicker] = useState(false);
  const hasLoggedFindingScreen = useRef(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  
  // Loading and error states for initial data fetch
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataFetchError, setDataFetchError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Fetch and listen to ride data on component mount
  const fetchRideData = useCallback(() => {
    if (!session?.user?.id) {
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setDataFetchError(null);

    // console.log('[PassengerHomeScreen] Fetching ride data for passenger:', session.user.id);

    try {
      unsubscribeRef.current = listenToActivePassengerRide(
        session.user.id,
        (ride) => {
          // console.log('[PassengerHomeScreen] Ride data updated:', ride?.status || 'no active ride');
          dispatch(setRide(ride));
          setIsLoadingData(false);
        },
        (error) => {
          console.error('[PassengerHomeScreen] Error fetching ride data:', error);
          setDataFetchError(error instanceof Error ? error.message : 'Failed to load ride data');
          setIsLoadingData(false);
        }
      );
    } catch (error) {
      console.error('[PassengerHomeScreen] Error setting up ride listener:', error);
      setDataFetchError(error instanceof Error ? error.message : 'Failed to fetch ride data');
      setIsLoadingData(false);
    }
  }, [session?.user?.id, dispatch]);

  useEffect(() => {
    fetchRideData();

    return () => {
      // console.log('[PassengerHomeScreen] Cleaning up ride listener');
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [fetchRideData]);

  useEffect(() => {
    setPickupInputValue(pickupLocation?.address ?? '');
  }, [pickupLocation?.address]);

  useEffect(() => {
    setDestinationInputValue(destinationLocation?.address ?? '');
  }, [destinationLocation?.address]);

  useEffect(() => {
    return () => {
      dispatch(clearRideError());
    };
  }, [dispatch]);

  const mapRegion = useMemo<Region>(() => {
    if (destinationLocation) {
      return {
        latitude: destinationLocation.coordinates.latitude,
        longitude: destinationLocation.coordinates.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.08,
      };
    }

    if (stopLocation) {
      return {
        latitude: stopLocation.coordinates.latitude,
        longitude: stopLocation.coordinates.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.08,
      };
    }

    if (pickupLocation) {
      return {
        latitude: pickupLocation.coordinates.latitude,
        longitude: pickupLocation.coordinates.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.08,
      };
    }

    return DEFAULT_REGION;
  }, [destinationLocation, pickupLocation, stopLocation]);

  const sessionUser = session?.user ?? null;
  const passengerUser = sessionUser?.role === 'passenger' ? sessionUser : null;
  const passengerName = sessionUser && sessionUser.firstName && sessionUser.lastName
    ? `@${sessionUser.firstName.toLowerCase()}_${sessionUser.lastName.toLowerCase()}`
    : '@passenger';
  const avatarLabel = sessionUser && sessionUser.firstName && sessionUser.lastName
    ? toInitials(sessionUser.firstName, sessionUser.lastName)
    : 'ME';

  const rideData = useMemo<RideMatchingData | null>(() => {
    if (!sessionUser) {
      return null;
    }

    return {
      pickupLocation,
      stopLocation,
      destinationLocation,
      rideType,
      scheduleType,
      paymentMethod,
      cancelBy: latestRide?.cancelBy ?? null,
      rider: {
        id: sessionUser.id,
        firstName: sessionUser.firstName,
        lastName: sessionUser.lastName,
        phone: sessionUser.phone,
        email: sessionUser.email,
      },
      driver: null,
    };
  }, [
    destinationLocation,
    paymentMethod,
    pickupLocation,
    rideType,
    scheduleType,
    sessionUser,
    stopLocation,
    latestRide?.cancelBy,
  ]);

  const formatCurrency = (amount: number) => `NGN${amount.toLocaleString()}`;
  const walletBalance = formatCurrency(passengerUser?.walletBalance ?? 0);
  const switchCoinBalance = passengerUser?.switchCoinBalance ?? 0;
  useEffect(() => {
    if (screen !== 'finding') {
      hasLoggedFindingScreen.current = false;
      return;
    }

    if (hasLoggedFindingScreen.current || !rideData || !sessionUser) {
      return;
    }

    hasLoggedFindingScreen.current = true;
  }, [rideData, screen, sessionUser]);

  useEffect(() => {
    if (
      screen !== 'finding' &&
      screen !== 'accepted' &&
      screen !== 'arrived' &&
      screen !== 'on_trip'
    ) {
      return;
    }

    if (rideStatus === 'cancelled' || rideStatus === 'completed' || rideStatus === 'idle') {
      setScreen('home');
      return;
    }

    const nextScreen = getScreenBasedOnRideStatus(rideStatus);

    if (nextScreen !== screen) {
      setScreen(nextScreen);
    }
  }, [rideStatus, screen]);

  const openRidePlanner = useCallback(() => {
    setScreen(getScreenBasedOnRideStatus(latestRide?.status));
  }, [latestRide?.status]);

  const onCancelRide = useCallback(async () => {
    const resultAction = await dispatch(cancelRideRequest());

    if (cancelRideRequest.fulfilled.match(resultAction)) {
      setScreen('home');
    }
  }, [dispatch]);

  if (!passengerUser) {
    return null;
  }

  const onSelectPickup = (location: RideLocation) => {
    setPickupInputValue(location.address);
    dispatch(setPickupLocation(location));
    dispatch(setStopLocation(null));
    dispatch(setDestinationLocation(null));
    setDestinationInputValue('');
    setShowStopPicker(false);
    setScreen('route');
  };

  const onSelectDestination = (location: RideLocation) => {
    setDestinationInputValue(location.address);
    dispatch(setDestinationLocation(location));
    setShowStopPicker(false);
  };

  const onContinueToVehicle = () => {
    if (!destinationLocation) {
      return;
    }

    setScreen('vehicle');
  };

  const onFindDriver = () => {
    setScreen('finding');
  };

  const onClearDestination = () => {
    dispatch(setStopLocation(null));
    dispatch(setDestinationLocation(null));
    setDestinationInputValue('');
    setShowStopPicker(false);
    setScreen('route');
  };

  const onSelectStopLocation = (location: RideLocation) => {
    dispatch(setStopLocation(location));
    setShowStopPicker(false);
  };

  const onBackPress = () => {
    if (screen === 'finding') {
      setScreen('home');
      return;
    }
    // if (screen === 'arrived') {
    //   setScreen('arrived');
    //   return;
    // }

    if (screen === 'vehicle') {
      setScreen('route');
      return;
    }

    if (screen === 'route') {
      setScreen('plan');
      return;
    }

    if (screen === 'plan') {
      setScreen('home');
      return;
    }

    onLogout();
  };

  const openDrawer = () => setDrawerVisible(true);
  const closeDrawer = () => setDrawerVisible(false);

  // Render loading overlay while fetching data
  if (isLoadingData && !latestRide) {
    return <LoadingOverlay visible={true} message="Loading your ride data..." />;
  }

  // Render error screen with retry
  if (dataFetchError && !latestRide) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appColors.surfaceLight, paddingHorizontal: 24 }}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          <AlertTriangle size={48} color={appColors.danger} strokeWidth={1.5} />
          <AppText variant="title" style={{ textAlign: 'center' }}>
            Unable to Load Ride Data
          </AppText>
          <AppText variant="body" style={{ textAlign: 'center', color: appColors.textMuted }}>
            {dataFetchError}
          </AppText>
        </View>
        <Pressable
          onPress={fetchRideData}
          style={{
            marginTop: 32,
            backgroundColor: appColors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <AppText variant="label" style={{ textAlign: 'center', color: appColors.textLight }}>
            Retry
          </AppText>
        </Pressable>
      </View>
    );
  }

  const onSelectVehicleOption = (selectedRideType: RideType) => {
    dispatch(setRideType(selectedRideType));
  };

  const canContinueToVehicle = Boolean(destinationLocation);
  const canFindDriver =
    Boolean(pickupLocation && destinationLocation) &&
    requestStatus !== 'loading';
  const startSummary = pickupLocation?.address ?? 'No pickup location selected';
  const stopSummary = stopLocation?.address ?? '';
  const destinationSummary =
    destinationLocation?.address ?? 'Select destination';
  const activeDriverName = latestRide?.driver
    ? `${latestRide.driver.firstName} ${latestRide.driver.lastName}`
    : 'Abayomi Owomoyela';

  const tripDateLabel = latestRide?.createdAt
    ? new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(latestRide.createdAt))
    : '12:55 PM Friday, May 23, 2025';

  if (
    screen === 'home' ||
    screen === 'finding' ||
    screen === 'accepted' ||
    screen === 'arrived' ||
    screen === 'on_trip'
  ) {
    return (
      <>
        <LoadingOverlay visible={isLoadingData} message="Updating ride data..." />
         <HomeView
           avatarLabel={avatarLabel}
           passengerName={passengerName}
           walletBalance={walletBalance}
           switchCoinBalance={switchCoinBalance}
           topInset={insets.top}
           bottomInset={insets.bottom}
           onRidePress={openRidePlanner}
           onShortcutPress={openRidePlanner}
           onAvatarPress={openDrawer}
           visible={screen === 'home'}
         />

         <PassengerDrawer
           visible={drawerVisible}
           onClose={closeDrawer}
           passengerName={sessionUser && sessionUser.firstName && sessionUser.lastName ? `${sessionUser.firstName} ${sessionUser.lastName}` : 'Passenger'}
           passengerPhone={sessionUser?.phone || ''}
           onLogout={() => {
             closeDrawer();
             onLogout();
           }}
         />

        <FindingView
          avatarLabel={avatarLabel}
          topInset={insets.top}
          bottomInset={insets.bottom}
          onBackPress={() => setScreen('home')}
          onCancelRide={onCancelRide}
          cancelLoading={cancelStatus === 'loading'}
          visible={screen === 'finding'}
        />

        <DriverArriveScreen
          visible={screen === 'accepted' || screen === 'arrived'}
          currentScreen={screen === 'accepted' ? 'accepted' : 'arrived'}
          topInset={insets.top}
          bottomInset={insets.bottom}
          mapRegion={mapRegion}
          pickupLocation={pickupLocation}
          stopLocation={stopLocation}
          destinationLocation={destinationLocation}
          rideType={rideType}
          avatarLabel={avatarLabel}
          switchCoinBalance={switchCoinBalance}
          paymentMethod={paymentMethod}
          driverName={activeDriverName}
          onBackPress={() => setScreen('home')}
          onCallDriver={() => undefined}
          onOpenChat={() => undefined}
          onOpenNotifications={() => undefined}
          onChangePaymentMethod={() => setScreen('vehicle')}
          onCancelRide={onCancelRide}
          cancelLoading={cancelStatus === 'loading'}
        />

        <EnRouteScreen
          visible={screen === 'on_trip'}
          topInset={insets.top}
          bottomInset={insets.bottom}
          mapRegion={mapRegion}
          pickupLocation={pickupLocation}
          stopLocation={stopLocation}
          destinationLocation={destinationLocation}
          passengerName={passengerName}
          driverName={activeDriverName}
          tripDateLabel={tripDateLabel}
          onBackPress={() => setScreen('home')}
          onCreateSchedule={() => undefined}
          onEditSchedule={() => undefined}
          onOpenTracking={() => undefined}
          onOpenChat={() => undefined}
        />
      </>
    );
  }

  return (
    <>
      <LoadingOverlay visible={isLoadingData} message="Updating ride data..." />
      <PlannerLayout
        title={getScreenTitle(screen)}
        avatarLabel={avatarLabel}
        mapRegion={mapRegion}
        pickupLocation={pickupLocation}
        stopLocation={stopLocation}
        destinationLocation={destinationLocation}
        showPolyline={screen === 'route' || screen === 'vehicle'}
        topInset={insets.top}
        bottomInset={insets.bottom}
        isVehicleScreen={screen === 'vehicle'}
        currentScreen={screen}
        onBackPress={onBackPress}
      >
      {screen === 'plan' ? (
        <PlanView
          passengerName={passengerName}
          pickupInputValue={pickupInputValue}
          error={error}
          scheduleType={scheduleType}
          onPickupInputChange={setPickupInputValue}
          onSelectPickup={onSelectPickup}
          onToggleSchedule={() =>
            dispatch(setScheduleType(scheduleType === 'now' ? 'later' : 'now'))
          }
        />
      ) : null}

      {screen === 'route' ? (
        <RouteView
          pickupAddress={pickupLocation?.address ?? 'No pickup location selected'}
          destinationInputValue={destinationInputValue}
          error={error}
          canContinueToVehicle={canContinueToVehicle}
          onDestinationInputChange={setDestinationInputValue}
          onSelectDestination={onSelectDestination}
          onContinue={onContinueToVehicle}
        />
      ) : null}

      {screen === 'vehicle' ? (
        <VehicleView
          startSummary={startSummary}
          stopSummary={stopSummary}
          destinationSummary={destinationSummary}
          rideType={rideType}
          paymentMethod={paymentMethod}
          requestStatus={requestStatus}
          showStopPicker={showStopPicker}
          stopLocation={stopLocation}
          onClearStop={() => dispatch(setStopLocation(null))}
          onToggleStopPicker={() => setShowStopPicker(current => !current)}
          onClearDestination={onClearDestination}
          onSelectStopLocation={onSelectStopLocation}
          onSelectVehicleOption={onSelectVehicleOption}
          onSelectPaymentMethod={setPaymentMethod}
          onFindDriver={onFindDriver}
          canFindDriver={canFindDriver}
        />
      ) : null}
      </PlannerLayout>
    </>
  );
}
