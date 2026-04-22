# Driver Ride Bottom Sheets System

## Overview

This is a comprehensive bottom sheet system for managing the entire driver ride lifecycle. It automatically displays the appropriate sheet based on the current ride status.

## Architecture

### Sheet Components

1. **RideRequestSheet** - Incoming ride request
   - Status: `requested`
   - Shows: Pickup/destination addresses, countdown timer
   - Actions: Skip, Accept

2. **c** - Driver accepted ride, heading to pickup
   - Status: `accepted`
   - Shows: Passenger info, pickup location, ETA
   - Actions: Start Trip, Cancel

3. **RideOnTripSheet** - Active trip, passenger in vehicle
   - Status: `on_trip`
   - Shows: Destination, passenger name, ETA, distance remaining
   - Actions: Arrived, Emergency

4. **RideArrivedSheet** - Driver arrived at pickup or destination
   - Status: `arrived`
   - Shows: Location, confirmation message, trip stats
   - Actions: Confirm Arrival, Later

5. **RideCompletedSheet** - Trip finished
   - Status: `completed`
   - Shows: Trip summary, earnings, passenger info
   - Actions: Rate Passenger, Done

### Smart Host Component

**DriverRideSheetHost.tsx** - Orchestrates all sheets

- Monitors Redux state (`driverCurrentRide`)
- Renders the appropriate sheet based on ride status
- Manages state transitions and API calls
- Handles all user interactions

### Redux State Management

**driverCurrentRideSlice.ts** - Centralized ride state

```typescript
type DriverCurrentRide = {
  id: string;
  status: RideStatus; // 'requested' | 'accepted' | 'on_trip' | 'arrived' | 'completed' | 'cancelled'
  passengerId: string;
  passengerName: string;
  pickupAddress: string;
  destinationAddress: string;
  // ... status-specific fields
};
```

**Available Actions:**
- `setCurrentRide(ride)` - Set entire ride
- `updateRideStatus(status)` - Change status
- `updateRideEstimates()` - Update ETA/distance for on_trip
- `updateCurrentRide(partial)` - Update specific fields
- `clearCurrentRide()` - Dismiss all sheets
- `setLoading(bool)` - Loading state
- `setError(msg)` - Error handling

## Usage

### 1. Replace Host in App.tsx

```typescript
import { DriverRideSheetHost } from './src/components/bottomsheets';

function RootNavigator() {
  const session = useAppSelector(state => state.auth.session);
  const isDriver = session?.user.role === 'driver';

  if (session) {
    return (
      <>
        <HomeScreen />
        {isDriver && <DriverRideSheetHost />}
      </>
    );
  }
}
```

### 2. Accept an Incoming Ride Request

When a ride request comes in via FCM:

```typescript
import { setCurrentRide } from '../store/driverCurrentRideSlice';

const dispatch = useAppDispatch();

dispatch(setCurrentRide({
  id: 'ride-123',
  status: 'requested',
  passengerId: 'passenger-xyz',
  passengerName: 'John Doe',
  pickupAddress: '123 Main St',
  destinationAddress: '456 Oak Ave',
  paymentMethod: 'Credit Card',
  expiresAt: new Date(Date.now() + 60000).toISOString(),
}));
```

### 3. Update Ride Status Through Lifecycle

```typescript
import { updateRideStatus, updateRideEstimates } from '../store/driverCurrentRideSlice';

// Accept ride
dispatch(updateRideStatus('accepted'));

// Start trip
dispatch(updateRideStatus('on_trip'));

// Update ETA during trip
dispatch(updateRideEstimates({
  estimatedTimeRemaining: '5 mins',
  estimatedDistance: '2.5 km'
}));

// Arrive at destination
dispatch(updateRideStatus('arrived'));

// Complete ride
dispatch(updateRideStatus('completed'));
```

### 4. Update Ride with Additional Data

```typescript
import { updateCurrentRide } from '../store/driverCurrentRideSlice';

dispatch(updateCurrentRide({
  tripDuration: '15 mins',
  tripDistance: '8.5 km',
  fare: 250.0,
}));
```

## State Flow Diagram

```
┌─────────────┐
│  Idle/Empty │
└──────┬──────┘
       │ Incoming FCM
       ▼
┌──────────────┐     User Skips
│  Requested   │────────────────────┐
└──────┬───────┘                     │
       │ User Accepts               │
       ▼                            │
┌──────────────┐ Driver Clicks      │
│  Accepted    │─Start Trip─────────┤
└──────┬───────┘                     │
       │                            │
       ▼                            │
┌──────────────┐ Driver Clicks      │
│  On Trip     │─Arrived────────────┤
└──────┬───────┘                     │
       │                            │
       ▼                            │
┌──────────────┐ User Confirms      │
│  Arrived     │─Arrival────────────┤
└──────┬───────┘                     │
       │                            │
       ▼                            │
┌──────────────┐ User Closes        │
│  Completed   │─Sheet──────────────┤
└──────┬───────┘                    │
       │                            │
       ▼◄───────────────────────────┘
┌─────────────┐
│  Idle/Empty │
└─────────────┘
```

## Integration Checklist

- [ ] Replace `DriverRideRequestSheetHost` with `DriverRideSheetHost` in App.tsx
- [ ] Update FCM message handling to use `setCurrentRide` action
- [ ] Implement API calls in DriverRideSheetHost for:
  - Accept ride
  - Start trip
  - Mark arrived
  - Complete ride
  - Update estimates
- [ ] Test each sheet transition
- [ ] Add error handling and retry logic
- [ ] Test with real ride data
- [ ] Add passive rating flow

## API Integration Points

Update the callback functions in `DriverRideSheetHost.tsx`:

```typescript
// 1. Accept Ride
handleRideRequestAccept = async (request) => {
  // Call: POST /api/rides/{rideId}/accept
}

// 2. Start Trip
handleStartTrip = async () => {
  // Call: POST /api/rides/{rideId}/start
}

// 3. Mark Arrived
handleArrived = async () => {
  // Call: POST /api/rides/{rideId}/arrived
}

// 4. Complete Ride
handleCompleteRide = async () => {
  // Call: POST /api/rides/{rideId}/complete
}

// 5. Update Estimates
handleUpdateEstimates = async () => {
  // Periodically call: PATCH /api/rides/{rideId}/estimates
}
```

## Styling

All sheets use consistent styling from:
- `theme/colors.ts` - Color palette
- `BaseBottomSheet.tsx` - Animation and container styling

Customize by updating the StyleSheet in each sheet component.

## Future Enhancements

1. **Passive Rating** - Auto-show rating after completion
2. **Location Tracking** - Real-time geolocation updates
3. **Notifications** - Push notifications for state changes
4. **Earnings Summary** - Weekly earnings dashboard
5. **Trip Replay** - Replay route on map after completion
6. **Chat** - In-app messaging with passenger
7. **Accessibility** - Screen reader support
8. **Animations** - Smoother transitions between sheets

## Troubleshooting

### Sheet Not Showing
- Check Redux store contains `driverCurrentRide` reducer
- Verify `DriverRideSheetHost` is mounted in App.tsx
- Check ride status matches expected value

### State Not Updating
- Ensure actions are dispatched to correct slice
- Verify middleware for async operations
- Check Redux DevTools for action history

### Styling Issues
- Check theme colors are imported from `theme/colors.ts`
- Verify BaseBottomSheet height prop (0.55 = 55% of screen)
- Test on different screen sizes
