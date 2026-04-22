import type React from 'react';

import type { RideLocation, RideType } from '../../../types/ride';

export type FlowScreen =
  | 'home'
  | 'plan'
  | 'route'
  | 'vehicle'
  | 'finding'
  | 'accepted'
  | 'arrived'
  | 'on_trip';

export type PassengerHomeIcon = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
  onPress?: () => void;
}>;

export type QuickPlace = {
  id: string;
  title: string;
  subtitle: string;
  location: RideLocation;
  icon: PassengerHomeIcon;
};

export type VehicleOption = {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  rideType: RideType;
  badge: 'STD' | 'REG';
};

export type PaymentOption = {
  id: string;
  title: string;
  subtitle: string;
};

export type HomeService = {
  id: string;
  title: string;
  icon: PassengerHomeIcon;
  fill: string;
  textColor: string;
  shape: 'left' | 'right' | 'center' | 'soft';
};

export type HomeShortcut = {
  id: string;
  title: string;
  subtitle: string;
  icon: PassengerHomeIcon;
};
