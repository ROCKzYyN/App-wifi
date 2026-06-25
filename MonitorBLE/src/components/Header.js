import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../styles/theme';

export default function Header({ connectedDevice }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Monitor BLE - ESP32</Text>
      {connectedDevice && (
        <Text style={styles.connectionStatus}>Status: Conectado com Segurança</Text>
      )}
    </View>
  );
}
