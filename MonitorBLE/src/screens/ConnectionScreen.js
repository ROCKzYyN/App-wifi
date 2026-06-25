import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Button
} from 'react-native';
import { styles } from '../styles/theme';

export default function ConnectionScreen({
  isScanning,
  allDevices,
  handleConnect,
  handleStartScan
}) {
  return (
    <View style={styles.screen}>
      <View style={{ width: '100%', alignItems: 'center' }}>
        <Text style={styles.title}>Dispositivos Encontrados</Text>
        <Text style={styles.subtitle}>Ligue o ESP32 com autenticação ativa</Text>
      </View>

      {isScanning && (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
      )}

      <FlatList
        data={allDevices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.deviceCard} onPress={() => handleConnect(item)}>
            <View>
              <Text style={styles.deviceName}>{item.name || "ESP32_Monitor_BLE"}</Text>
              <Text style={styles.deviceMac}>{item.id}</Text>
            </View>
            <Text style={styles.connectLink}>Parear &gt;</Text>
          </TouchableOpacity>
        )}
        style={styles.list}
        ListEmptyComponent={
          !isScanning && <Text style={styles.emptyText}>Nenhum dispositivo encontrado.</Text>
        }
      />

      <View style={{ width: '100%', marginTop: 10 }}>
        <Button
          title={isScanning ? "Buscando..." : "Buscar ESP32"}
          onPress={handleStartScan}
          disabled={isScanning}
        />
      </View>
    </View>
  );
}
