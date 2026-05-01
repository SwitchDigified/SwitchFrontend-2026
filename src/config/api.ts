import Config from 'react-native-config';

export const API_BASE_URL = 'http://localhost:4000';
// export const API_BASE_URL = 'https://switch-server-coral.vercel.app';
export const API_TIMEOUT_MS = 15000;

// Safely access the Google Maps API key with fallback
// Handle case where react-native-config is not properly initialized
const FALLBACK_API_KEY = 'AIzaSyBWM3mSjwH0AGvePtRzsemxzUPAMZlHOUQ';

export const GOOGLE_MAPS_DIRECTIONS_API_KEY = 
  Config?.GOOGLE_MAPS_DIRECTIONS_API_KEY || FALLBACK_API_KEY;
