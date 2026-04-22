import React from 'react';
import { Polyline } from 'react-native-maps';
import {
  ROUTE_COLORS,
  ROUTE_STROKE_WIDTH,
  ROUTE_STROKE_WIDTH_DASHED,
} from './constants';
import { Coordinate, RideStatus, RouteData } from './types';

type RoutePolylinesProps = {
  routeData: RouteData;
  rideStatus: RideStatus;
};

/**
 * Renders route polylines on the map based on ride status:
 *
 * incoming_request → driver→pickup (blue dashed) + pickup→destination (green dashed)
 * accepted         → driver→pickup (blue solid)
 * on_trip          → pickup→destination (green solid)
 */
export const RoutePolylines: React.FC<RoutePolylinesProps> = ({
  routeData,
  rideStatus,
}) => {
  const { driverToPickup, pickupToDestination } = routeData;

  const showDriverToPickup =
    rideStatus === 'incoming_request' || rideStatus === 'accepted';

  const showPickupToDestination =
    rideStatus === 'incoming_request' || rideStatus === 'on_trip';

  // For incoming_request both lines are dashed to signal "preview"
  const isDashed = rideStatus === 'incoming_request';

  return (
    <>
      {showDriverToPickup && driverToPickup.length > 1 && (
        <Polyline
          coordinates={driverToPickup as { latitude: number; longitude: number }[]}
          strokeColor={ROUTE_COLORS.driverToPickup}
          strokeWidth={isDashed ? ROUTE_STROKE_WIDTH_DASHED : ROUTE_STROKE_WIDTH}
          // lineDashPattern={isDashed ? [12, 6] : undefined}
          lineJoin="round"
          lineCap="round"
        />
      )}

      {showPickupToDestination && pickupToDestination.length > 1 && (
        <Polyline
          coordinates={pickupToDestination as { latitude: number; longitude: number }[]}
          strokeColor={ROUTE_COLORS.pickupToDestination}
          strokeWidth={isDashed ? ROUTE_STROKE_WIDTH_DASHED : ROUTE_STROKE_WIDTH}
          // lineDashPattern={isDashed ? [12, 6] : undefined}
          lineJoin="round"
          lineCap="round"
        />
      )}
    </>
  );
};
