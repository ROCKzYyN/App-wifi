import React, { useState } from 'react';
import { SafeAreaView, Alert } from 'react-native';
import { useWiFi } from './src/hooks/useWiFi';
import { useBLEMockado } from './src/hooks/useBLEMockado';
import { styles } from './src/styles/theme';
import Header from './src/components/Header';
import ConnectionScreen from './src/screens/ConnectionScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ControlScreen from './src/screens/ControlScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Connection');
  const [isScanning, setIsScanning] = useState(false);
  const [isMockEnabled, setIsMockEnabled] = useState(false);

  const wifiReal = useWiFi();
  const bleMock = useBLEMockado();
  
  const ble = isMockEnabled ? bleMock : wifiReal;


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
    sendCommand,
    // Novos estados
    rssi,
    rssiHistory,
    packetsPerMinute,
    hourlyTempHistory,
    hourlyHumHistory,
    hourlyLabels
  } = ble;

  const handleStartScan = async () => {
    const hasPermissions = await requestPermissions();
    if (hasPermissions) {
      setIsScanning(true);
      scanForDevices();
      setTimeout(() => { setIsScanning(false); }, 3000); // 3 segundos para carregar canais é suficiente
    } else {
      Alert.alert("Erro", "Não foi possível buscar canais.");
    }
  };

  const handleConnect = async (device) => {
    setIsScanning(false);
    const success = await connectToDevice(device);
    if (success) {
      setCurrentScreen('Dashboard');
    } else {
      Alert.alert("Erro", "Falha ao conectar ao Broker MQTT. Verifique a conexão e o prefixo do ESP32.");
    }
  };


  const handleDisconnect = async () => {
    await disconnectDevice();
    setCurrentScreen('Connection');
  };

  const handleToggleMock = async (newVal) => {
    if (connectedDevice) {
      await disconnectDevice();
    }
    setIsMockEnabled(newVal);
    setCurrentScreen('Connection'); // volta para a tela de conexão ao alternar para re-escanear
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho Fixo */}
      <Header 
        connectedDevice={connectedDevice} 
        isMockEnabled={isMockEnabled}
        onToggleMock={handleToggleMock}
      />

      {/* TELA 1: CONEXÃO */}
      {currentScreen === 'Connection' && (
        <ConnectionScreen
          isScanning={isScanning}
          allDevices={allDevices}
          handleConnect={handleConnect}
          handleStartScan={handleStartScan}
        />
      )}

      {/* TELA 2: DASHBOARD COM GRÁFICOS */}
      {currentScreen === 'Dashboard' && (
        <DashboardScreen
          telemetry={telemetry}
          tempHistory={tempHistory}
          humHistory={humHistory}
          sendCommand={sendCommand}
          setCurrentScreen={setCurrentScreen}
          handleDisconnect={handleDisconnect}
          // Novos dados passados
          rssi={rssi}
          rssiHistory={rssiHistory}
          packetsPerMinute={packetsPerMinute}
          hourlyTempHistory={hourlyTempHistory}
          hourlyHumHistory={hourlyHumHistory}
          hourlyLabels={hourlyLabels}
        />
      )}

      {/* TELA 3: CONTROLE DE LEDS E RGB */}
      {currentScreen === 'Control' && (
        <ControlScreen
          ledsState={ledsState}
          writeLeds={writeLeds}
          writeRgb={writeRgb}
          setCurrentScreen={setCurrentScreen}
          // Novos dados de RSSI passados
          rssi={rssi}
          rssiHistory={rssiHistory}
        />
      )}
    </SafeAreaView>
  );
}