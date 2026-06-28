import React from 'react';
import { View, Text, Switch, TouchableOpacity } from 'react-native';
import { styles } from '../styles/theme';

export default function Header({ connectedDevice }) {
  return (
    <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Monitor Wi-Fi - ESP32</Text>
        {connectedDevice ? (
          <Text style={styles.connectionStatus}>Status: Conectado</Text>
        ) : (
          <Text style={styles.connectionStatus}>Status: Desconectado</Text>
        )}
      </View>
    </View>
  );
}

