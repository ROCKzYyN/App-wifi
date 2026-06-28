import React from 'react';
import { ScrollView, View, Text, Button } from 'react-native';
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

export default function DashboardScreen({
  telemetry,
  tempHistory,
  humHistory,
  sendCommand,
  setCurrentScreen,
  handleDisconnect,
  // Novos dados
  rssi,
  rssiHistory,
  packetsPerMinute,
  hourlyTempHistory,
  hourlyHumHistory,
  hourlyLabels
}) {
  const tempF = (telemetry.temp * 1.8) + 32;
  const minTempF = (telemetry.minTemp * 1.8) + 32;
  const maxTempF = (telemetry.maxTemp * 1.8) + 32;

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Painel de Telemetria</Text>

      {/* Métricas de Conexão (PPM & RSSI) */}
      <View style={[styles.card, { backgroundColor: '#ECEFF1', width: '100%', marginBottom: 15, marginHorizontal: 0 }]}>
        <Text style={styles.cardLabel}>Métricas de Conexão (Wi-Fi)</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <View>
            <Text style={{ fontSize: 12, color: '#555' }}>Intensidade de Sinal (RSSI)</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>
              {rssi} dBm <Text style={{ fontSize: 13, color: getRssiColor(rssi), fontWeight: 'bold' }}>({getRssiLabel(rssi)})</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 12, color: '#555' }}>Frequência de Dados</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#007AFF' }}>
              {packetsPerMinute} PPM
            </Text>
          </View>
        </View>
      </View>

      {/* Cards de Leitura em Tempo Real */}
      <View style={styles.row}>
        <View style={[styles.card, { backgroundColor: '#E3F2FD' }]}>
          <Text style={styles.cardLabel}>Temperatura</Text>
          <Text style={styles.cardValue}>{telemetry.temp.toFixed(1)}°C</Text>
          <Text style={{ fontSize: 14, color: '#455A64', fontWeight: 'bold', marginBottom: 5 }}>
            {tempF.toFixed(1)}°F
          </Text>
          <Text style={styles.cardSub}>
            Min: {telemetry.minTemp.toFixed(1)}°C ({minTempF.toFixed(1)}°F)
          </Text>
          <Text style={styles.cardSub}>
            Max: {telemetry.maxTemp.toFixed(1)}°C ({maxTempF.toFixed(1)}°F)
          </Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#E8F5E9' }]}>
          <Text style={styles.cardLabel}>Umidade</Text>
          <Text style={styles.cardValue}>{telemetry.hum.toFixed(1)}%</Text>
          <Text style={{ height: 19 }} />
          <Text style={styles.cardSub}>
            Min: {telemetry.minHum.toFixed(1)}%
          </Text>
          <Text style={styles.cardSub}>
            Max: {telemetry.maxHum.toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Gráfico de Temperatura */}
      <Text style={styles.chartTitle}>Histórico de Temperatura Recente (°C)</Text>
      {tempHistory && tempHistory.length > 0 && (
        <LineChart
          data={{ datasets: [{ data: tempHistory }] }}
          width={screenWidth - 40}
          height={150}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      )}

      {/* Gráfico de Umidade */}
      <Text style={styles.chartTitle}>Histórico de Umidade Recente (%)</Text>
      {humHistory && humHistory.length > 0 && (
        <LineChart
          data={{ datasets: [{ data: humHistory }] }}
          width={screenWidth - 40}
          height={150}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`
          }}
          bezier
          style={styles.chart}
        />
      )}

      {/* Gráfico Combinado de Hora em Hora */}
      <Text style={styles.chartTitle}>Histórico Combinado (Hora em Hora)</Text>
      {hourlyTempHistory && hourlyTempHistory.length > 0 && (
        <LineChart
          data={{
            labels: hourlyLabels || [],
            datasets: [
              {
                data: hourlyTempHistory,
                color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
                strokeWidth: 2
              },
              {
                data: hourlyHumHistory,
                color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                strokeWidth: 2
              }
            ],
            legend: ["Temp (°C)", "Umid (%)"]
          }}
          width={screenWidth - 40}
          height={180}
          chartConfig={{
            ...chartConfig,
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 1
          }}
          bezier
          style={styles.chart}
        />
      )}

      {/* Gráfico de RSSI */}
      <Text style={styles.chartTitle}>Histórico de Sinal (RSSI em dBm)</Text>
      {rssiHistory && rssiHistory.length > 0 && (
        <LineChart
          data={{ datasets: [{ data: rssiHistory }] }}
          width={screenWidth - 40}
          height={130}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(96, 125, 139, ${opacity})`,
            propsForDots: { r: '3', strokeWidth: '1.5', stroke: '#607D8B' }
          }}
          bezier
          style={styles.chart}
        />
      )}

      {/* Comandos do Hardware */}
      <View style={styles.buttonGroup}>
        <Button
          title="Resetar Mín/Máx (ESP32)"
          color="#FFA000"
          onPress={() => sendCommand(1)}
        />
        <View style={{ height: 10 }} />
        <Button
          title="Mudar Tela do LCD Físico"
          color="#7B1FA2"
          onPress={() => sendCommand(2)}
        />
        <View style={{ height: 10 }} />
        <Button
          title="Ir para Controles de LED"
          onPress={() => setCurrentScreen('Control')}
        />
        <View style={{ height: 10 }} />
        <Button
          title="Desconectar"
          color="red"
          onPress={handleDisconnect}
        />
      </View>
    </ScrollView>
  );
}
