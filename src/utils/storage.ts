import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RideLocation } from '../types/ride';

const RECENT_PLACES_KEY = '@switch_recent_places';
const MAX_RECENT_PLACES = 3;

export type RecentPlace = RideLocation & {
  timestamp: number;
};

/**
 * Get all recent places from storage
 */
export async function getRecentPlaces(): Promise<RecentPlace[]> {
  try {
    const data = await AsyncStorage.getItem(RECENT_PLACES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading recent places:', error);
    return [];
  }
}

/**
 * Add a place to recent places
 * Removes duplicates and keeps only the most recent MAX_RECENT_PLACES
 */
export async function addRecentPlace(place: RideLocation): Promise<RecentPlace[]> {
  try {
    let recentPlaces = await getRecentPlaces();

    // Remove if same place already exists (based on placeId)
    if (place.placeId) {
      recentPlaces = recentPlaces.filter(p => p.placeId !== place.placeId);
    }

    // Create new recent place with timestamp
    const newPlace: RecentPlace = {
      ...place,
      timestamp: Date.now(),
    };

    // Add to beginning and keep only MAX_RECENT_PLACES
    recentPlaces.unshift(newPlace);
    recentPlaces = recentPlaces.slice(0, MAX_RECENT_PLACES);

    // Save to storage
    await AsyncStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(recentPlaces));

    return recentPlaces;
  } catch (error) {
    console.error('Error adding recent place:', error);
    return [];
  }
}

/**
 * Clear all recent places
 */
export async function clearRecentPlaces(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_PLACES_KEY);
  } catch (error) {
    console.error('Error clearing recent places:', error);
  }
}

/**
 * Remove a specific recent place
 */
export async function removeRecentPlace(placeId: string): Promise<RecentPlace[]> {
  try {
    let recentPlaces = await getRecentPlaces();
    recentPlaces = recentPlaces.filter(p => p.placeId !== placeId);
    await AsyncStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(recentPlaces));
    return recentPlaces;
  } catch (error) {
    console.error('Error removing recent place:', error);
    return [];
  }
}
