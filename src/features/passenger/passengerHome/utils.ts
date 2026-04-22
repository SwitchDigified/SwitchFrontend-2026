import type { FlowScreen } from './types';

export const toInitials = (firstName: string, lastName: string) => {
  const left = firstName.trim().charAt(0).toUpperCase();
  const right = lastName.trim().charAt(0).toUpperCase();

  return `${left}${right}`.trim() || 'ME';
};

export const getScreenTitle = (screen: FlowScreen) => {
  if (screen === 'route') {
    return 'Your route';
  }

  if (screen === 'vehicle') {
    return 'Find Your Vehicle';
  }

  if (screen === 'finding') {
    return 'Find Driver';
  }

  if (screen === 'accepted' || screen === 'arrived') {
    return 'Driver Arrived';
  }

  if (screen === 'on_trip') {
    return 'En Route';
  }

  return 'Plan your ride';
};
