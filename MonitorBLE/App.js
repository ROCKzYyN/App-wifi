import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Button,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useBLE } from './src/hooks/useBLE';

const screenWidth = Dimensions.get("window").width;

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Connection');
  const [isScanning, setIsScanning] = useState(false);

  const {
    requestPermissions,
    scanForDevices,
    allDevices,
    connectToDevice,
    connectedDevice,
    disconnectDevice,
    telemetry,
    tempHistory,
    humHistory,
    ledsState,
    writeLeds,
    writeRgb,
    sendCommand
  } = useBLE();

  const handleStartScan = async () => {
    const hasPermissions = await requestPermissions();
    if (hasPermissions) {
      setIsScanning(true);
      scanForDevices();
      setTimeout(() => { setIsScanning(false); }, 10000);
    } else {
      Alert.alert("Permissão Negada", "Ative o Bluetooth e a Localização nas configurações.");
    }
  };

  const handleConnect = async (device) => {
    setIsScanning(false);
    const success = await connectToDevice(device);
    if (success) {
      setCurrentScreen('Dashboard');
    } else {
      Alert.alert("Erro", "Falha ao conectar por Passkey. Verifique o ESP32.");
    }
  };

  const handleDisconnect = async () => {
    await disconnectDevice();
    setCurrentScreen('Connection');
  };

  // Configuração visual padrão dos gráficos do trabalho
  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#007AFF" }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho Fixo */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Monitor BLE - ESP32</Text>
        {connectedDevice && (
          <Text style={styles.connectionStatus}>Status: Conectado com Segurança</Text>
        )}
      </View>

      {/* TELA 1: CONEXÃO */}
      {currentScreen === 'Connection' && (
        <View style={styles.screen}>
          <Text style={styles.title}>Dispositivos Encontrados</Text>
          <Text style={styles.subtitle}>Ligue o ESP32 com autenticação ativa</Text>

          {isScanning && <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />}

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
            ListEmptyComponent={!isScanning && <Text style={styles.emptyText}>Nenhum dispositivo encontrado.</Text>}
          />
          <Button title={isScanning ? "Buscando..." : "Buscar ESP32"} onPress={handleStartScan} disabled={isScanning} />
        </View>
      )}

      {/* TELA 2: DASHBOARD COM GRÁFICOS */}
      {currentScreen === 'Dashboard' && (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Painel de Telemetria</Text>

          {/* Cards de Leitura em Tempo Real */}
          <View style={styles.row}>
            <View style={[styles.card, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.cardLabel}>Temperatura</Text>
              <Text style={styles.cardValue}>{telemetry.temp.toFixed(1)}°C</Text>
              <Text style={styles.cardSub}>Min: {telemetry.minTemp.toFixed(1)}° | Max: {telemetry.maxTemp.toFixed(1)}°</Text>
            </View>
            <View style={[styles.card, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.cardLabel}>Umidade</Text>
              <Text style={styles.cardValue}>{telemetry.hum.toFixed(1)}%</Text>
              <Text style={styles.cardSub}>Min: {telemetry.minHum.toFixed(1)}% | Max: {telemetry.maxHum.toFixed(1)}%</Text>
            </View>
          </View>

          {/* Gráfico de Temperatura */}
          <Text style={styles.chartTitle}>Histórico de Temperatura (°C)</Text>
          <LineChart
            data={{ datasets: [{ data: tempHistory }] }}
            width={screenWidth - 40}
            height={160}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />

          {/* Gráfico de Umidade */}
          <Text style={styles.chartTitle}>Histórico de Umidade (%)</Text>
          <LineChart
            data={{ datasets: [{ data: humHistory }] }}
            width={screenWidth - 40}
            height={160}
            chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})` }}
            bezier
            style={styles.chart}
          />

          {/* Comandos do Hardware */}
          <View style={styles.buttonGroup}>
            <Button title="Resetar Mín/Máx (ESP32)" color="#FFA000" onPress={() => sendCommand(1)} />
            <View style={{ height: 10 }} />
            <Button title="Mudar Tela do LCD Físico" color="#7B1FA2" onPress={() => sendCommand(2)} />
            <View style={{ height: 10 }} />
            <Button title="Ir para Controles de LED" onPress={() => setCurrentScreen('Control')} />
            <View style={{ height: 10 }} />
            <Button title="Desconectar" color="red" onPress={handleDisconnect} />
          </View>
        </ScrollView>
      )}

      {/* TELA 3: CONTROLE DE LEDS E RGB */}
      {currentScreen === 'Control' && (
        <View style={styles.screen}>
          <Text style={styles.title}>Painel de Controle</Text>
          <Text style={styles.subtitle}>Comandos diretos para os pinos do ESP32</Text>

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
            <TouchableOpacity style={[styles.rgbBtn, { backgroundColor: 'red' }]} onPress={() => writeRgb(255, 0, 0)} />
            <TouchableOpacity style={[styles.rgbBtn, { backgroundColor: 'green' }]} onPress={() => writeRgb(0, 255, 0)} />
            <TouchableOpacity style={[styles.rgbBtn, { backgroundColor: 'blue' }]} onPress={() => writeRgb(0, 0, 255)} />
            <TouchableOpacity style={[styles.rgbBtn, { backgroundColor: 'purple' }]} onPress={() => writeRgb(128, 0, 128)} />
            <TouchableOpacity style={[styles.rgbBtn, { backgroundColor: '#000', borderWidth: 1, borderColor: '#ccc' }]} onPress={() => writeRgb(0, 0, 0)} />
          </View>

          <View style={{ width: '100%', marginTop: 'auto' }}>
            <Button title="Voltar ao Dashboard" onPress={() => setCurrentScreen('Dashboard')} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#007AFF', padding: 20, alignItems: 'center', paddingTop: 40 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  connectionStatus: { color: '#E0F7FA', fontSize: 12, marginTop: 5 },
  screen: { flex: 1, padding: 20, alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  card: { flex: 1, padding: 15, borderRadius: 12, marginHorizontal: 5, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  cardLabel: { fontSize: 14, color: '#555', fontWeight: '600' },
  cardValue: { fontSize: 26, fontWeight: 'bold', color: '#222', marginVertical: 5 },
  cardSub: { fontSize: 11, color: '#666' },
  chartTitle: { alignSelf: 'flex-start', fontSize: 16, fontWeight: 'bold', color: '#444', marginTop: 15, marginBottom: 8 },
  chart: { borderRadius: 12, elevation: 2, marginBottom: 10 },
  buttonGroup: { width: '100%', marginTop: 15 },
  list: { width: '100%', marginBottom: 20 },
  deviceCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, elevation: 2 },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  deviceMac: { fontSize: 12, color: '#999' },
  connectLink: { color: '#007AFF', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 40 },
  ledControlCard: { backgroundColor: '#fff', width: '100%', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, elevation: 1 },
  ledLabel: { fontSize: 16, fontWeight: '500', color: '#333' },
  rgbContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 15 },
  rgbBtn: { width: 50, height: 50, borderRadius: 25, elevation: 3 }
});