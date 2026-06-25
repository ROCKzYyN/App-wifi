import React from 'react';
import { ScrollView, View, Text, Button } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { styles, chartConfig, screenWidth } from '../styles/theme';

export default function DashboardScreen({
  telemetry,
  tempHistory,
  humHistory,
  sendCommand,
  setCurrentScreen,
  handleDisconnect
}) {
  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Painel de Telemetria</Text>

      {/* Cards de Leitura em Tempo Real */}
      <View style={styles.row}>
        <View style={[styles.card, { backgroundColor: '#E3F2FD' }]}>
          <Text style={styles.cardLabel}>Temperatura</Text>
          <Text style={styles.cardValue}>{telemetry.temp.toFixed(1)}°C</Text>
          <Text style={styles.cardSub}>
            Min: {telemetry.minTemp.toFixed(1)}° | Max: {telemetry.maxTemp.toFixed(1)}°
          </Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#E8F5E9' }]}>
          <Text style={styles.cardLabel}>Umidade</Text>
          <Text style={styles.cardValue}>{telemetry.hum.toFixed(1)}%</Text>
          <Text style={styles.cardSub}>
            Min: {telemetry.minHum.toFixed(1)}% | Max: {telemetry.maxHum.toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Gráfico de Temperatura */}
      <Text style={styles.chartTitle}>Histórico de Temperatura (°C)</Text>
      {tempHistory && tempHistory.length > 0 && (
        <LineChart
          data={{ datasets: [{ data: tempHistory }] }}
          width={screenWidth - 40}
          height={160}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      )}

      {/* Gráfico de Umidade */}
      <Text style={styles.chartTitle}>Histórico de Umidade (%)</Text>
      {humHistory && humHistory.length > 0 && (
        <LineChart
          data={{ datasets: [{ data: humHistory }] }}
          width={screenWidth - 40}
          height={160}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`
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
