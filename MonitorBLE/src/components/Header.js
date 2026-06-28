import React from 'react';
import { View, Text, Switch, TouchableOpacity } from 'react-native';
import { styles } from '../styles/theme';

export default function Header({ connectedDevice, isMockEnabled, onToggleMock }) {
  return (
    <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Monitor BLE - ESP32</Text>
        {connectedDevice ? (
          <Text style={styles.connectionStatus}>Status: Conectado ({isMockEnabled ? 'Simulação' : 'Seguro'})</Text>
        ) : (
          <Text style={styles.connectionStatus}>Status: Desconectado</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold', marginRight: 5 }}>MOCK</Text>
        <Switch
          value={isMockEnabled}
          onValueChange={onToggleMock}
          trackColor={{ false: '#767577', true: '#34C759' }}
          thumbColor={isMockEnabled ? '#fff' : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
        />
      </View>
    </View>
  );
}
