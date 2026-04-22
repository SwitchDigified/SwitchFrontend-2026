import React, { useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { UberMap } from './UberMap';
import {
  DUMMY_DESTINATION,
  DUMMY_DRIVER_LOCATION,
  DUMMY_PICKUP_LOCATION,
} from './constants';
import { RideStatus } from './types';

const STATUS_OPTIONS: { label: string; value: RideStatus }[] = [
  { label: 'Incoming', value: 'incoming_request' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'On Trip', value: 'on_trip' },
];

export default function DemoScreen() {
  const [rideStatus, setRideStatus] = useState<RideStatus>('incoming_request');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Uber Map Demo</Text>
        <Text style={styles.subtitle}>Lagos · Idumiisheri</Text>
      </View>

      {/* Status Switcher */}
      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map(({ label, value }) => (
          <TouchableOpacity
            key={value}
            style={[
              styles.statusPill,
              rideStatus === value && styles.statusPillActive,
            ]}
            onPress={() => setRideStatus(value)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.statusPillText,
                rideStatus === value && styles.statusPillTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Map */}
      <View style={styles.mapWrapper}>
        <UberMap
          driverLocation={DUMMY_DRIVER_LOCATION}
          pickupLocation={DUMMY_PICKUP_LOCATION}
          destination={DUMMY_DESTINATION}
          rideStatus={rideStatus}
        />
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <LegendItem color="#1C6EF2" label="Driver → Pickup" />
        <LegendItem color="#00C853" label="Pickup → Destination" />
      </View>
    </SafeAreaView>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },

  // Status switcher
  statusRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  statusPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#EAECF0',
    alignItems: 'center',
  },
  statusPillActive: {
    backgroundColor: '#1C6EF2',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  statusPillTextActive: {
    color: '#fff',
  },

  // Map
  mapWrapper: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#DDE3EA',
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
});
