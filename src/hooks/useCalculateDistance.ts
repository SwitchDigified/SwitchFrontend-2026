import { useEffect, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import type { RideCoordinates } from '../store/driverCurrentRideSlice';

export type DistanceAndTime = {
  distanceKm: number;
  timeRemaining: string; // Format: "5 min" or "1 hour 30 min"
  distanceString: string; // Format: "5.2 km"
};

/**
 * Custom hook to calculate distance and time remaining between two locations
 * Listens to currentRide and location changes, updates in real-time
 * 
 * @param startLocation - Starting coordinates {latitude, longitude}
 * @param endLocation - Ending coordinates {latitude, longitude}
 * @returns Object with distanceKm, timeRemaining (formatted), and distanceString
 */
export const useCalculateDistance = (
  startLocation: RideCoordinates | null | undefined,
  endLocation: RideCoordinates | null | undefined
): DistanceAndTime => {
  const [result, setResult] = useState<DistanceAndTime>({
    distanceKm: 0,
    timeRemaining: '0 min',
    distanceString: '0 km',
  });

  // Get current ride and location from Redux store
  const currentRide = useAppSelector((state) => state.driverCurrentRide.currentRide);
  const currentLocation = useAppSelector((state) => state.driverLocation.currentLocation);

  /**
   * Haversine formula to calculate distance between two coordinates
   * @returns Distance in kilometers
   */
  const calculateHaversineDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /**
   * Format time from minutes to readable string
   * @returns Formatted time string (e.g., "5 min", "1 hour 30 min")
   */
  const formatTime = (minutes: number): string => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins} min`;
  };

  /**
   * Calculate time based on distance
   * Uses average speed of 40 km/h for urban driving
   * @returns Time in minutes
   */
  const calculateTimeFromDistance = (distanceKm: number): number => {
    const AVERAGE_SPEED = 40; // km/h for urban driving
    return (distanceKm / AVERAGE_SPEED) * 60; // Convert to minutes
  };

  useEffect(() => {
    // Validate inputs
    if (
      !startLocation?.latitude ||
      !startLocation?.longitude ||
      !endLocation?.latitude ||
      !endLocation?.longitude
    ) {
      setResult({
        distanceKm: 0,
        timeRemaining: '0 min',
        distanceString: '0 km',
      });
      return;
    }

    // Calculate distance between start and end locations
    const distance = calculateHaversineDistance(
      startLocation.latitude,
      startLocation.longitude,
      endLocation.latitude,
      endLocation.longitude
    );

    // Calculate time based on distance
    const timeInMinutes = calculateTimeFromDistance(distance);

    setResult({
      distanceKm: distance,
      timeRemaining: formatTime(timeInMinutes),
      distanceString: `${distance.toFixed(1)} km`,
    });
  }, [startLocation, endLocation, currentRide, currentLocation]);

  return result;
};
