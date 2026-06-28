import React from 'react';
import { ScrollView, View, Text, Button, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { styles, chartConfig, screenWidth } from '../styles/theme';

const getRssiLabel = (rssiVal) => {
  if (rssiVal >= -60) return 'Excelente';
  if (rssiVal >= -70) return 'Bom';
  if (rssiVal >= -85) return 'Regular';
  return 'Fraco';
};

const getRssiColor = (rssiVal) => {
  if (rssiVal >= -60) return '#4CAF50';
  if (rssiVal >= -70) return '#8BC34A';
  if (rssiVal >= -85) return '#FF9800';
  return '#F44336';
};

export default function ControlScreen({
  ledsState,
  writeLeds,
  writeRgb,
  setCurrentScreen,
  // Novos dados
  rssi,
  rssiHistory
}) {
  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={{ width: '100%', alignItems: 'center' }}>
        <Text style={styles.title}>Painel de Controle</Text>
        <Text style={styles.subtitle}>Comandos diretos para os pinos do ESP32</Text>

        {/* Monitor RSSI do Link */}
        <View style={[styles.card, { backgroundColor: '#ECEFF1', width: '100%', marginBottom: 15, marginHorizontal: 0 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardLabel}>Sinal da Conexão (RSSI):</Text>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: getRssiColor(rssi) }}>
              {rssi} dBm ({getRssiLabel(rssi)})
            </Text>
          </View>
        </View>

        {/* Chaves ON/OFF dos LEDs Simples */}
        <View style={styles.ledControlCard}>
          <Text style={styles.ledLabel}>LED Rele 1 (Pino 2)</Text>
          <Button
            title={ledsState.led1 ? "DESLIGAR" : "LIGAR"}
            color={ledsState.led1 ? "red" : "green"}
            onPress={() => writeLeds(!ledsState.led1, ledsState.led2)}
          />
        </View>

        <View style={styles.ledControlCard}>
          <Text style={styles.ledLabel}>LED Rele 2 (Pino 15)</Text>
          <Button
            title={ledsState.led2 ? "DESLIGAR" : "LIGAR"}
            color={ledsState.led2 ? "red" : "green"}
            onPress={() => writeLeds(ledsState.led1, !ledsState.led2)}
          />
        </View>

        {/* Seletor Rápido de Cores do RGB */}
        <Text style={[styles.chartTitle, { marginTop: 20 }]}>Controle do LED RGB</Text>
        <View style={styles.rgbContainer}>
          <TouchableOpacity
            style={[styles.rgbBtn, { backgroundColor: 'red' }]}
            onPress={() => writeRgb(255, 0, 0)}
          />
          <TouchableOpacity
            style={[styles.rgbBtn, { backgroundColor: 'green' }]}
            onPress={() => writeRgb(0, 255, 0)}
          />
          <TouchableOpacity
            style={[styles.rgbBtn, { backgroundColor: 'blue' }]}
            onPress={() => writeRgb(0, 0, 255)}
          />
          <TouchableOpacity
            style={[styles.rgbBtn, { backgroundColor: 'purple' }]}
            onPress={() => writeRgb(128, 0, 128)}
          />
          <TouchableOpacity
            style={[
              styles.rgbBtn,
              { backgroundColor: '#000', borderWidth: 1, borderColor: '#ccc' }
            ]}
            onPress={() => writeRgb(0, 0, 0)}
          />
        </View>

        {/* Gráfico do Histórico de RSSI */}
        <Text style={[styles.chartTitle, { marginTop: 20 }]}>Histórico de Sinal (RSSI)</Text>
        {rssiHistory && rssiHistory.length > 0 && (
          <LineChart
            data={{ datasets: [{ data: rssiHistory }] }}
            width={screenWidth - 40}
            height={110}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(96, 125, 139, ${opacity})`,
              propsForDots: { r: '3', strokeWidth: '1.5', stroke: '#607D8B' }
            }}
            bezier
            style={styles.chart}
          />
        )}
      </View>

      <View style={{ width: '100%', marginTop: 25 }}>
        <Button
          title="Voltar ao Dashboard"
          onPress={() => setCurrentScreen('Dashboard')}
        />
      </View>
    </ScrollView>
  );
}
