import React, { useState } from 'react';
import { SafeAreaView, Alert } from 'react-native';
import { useBLE } from './src/hooks/useBLE';
import { styles } from './src/styles/theme';
import Header from './src/components/Header';
import ConnectionScreen from './src/screens/ConnectionScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ControlScreen from './src/screens/ControlScreen';

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho Fixo */}
      <Header connectedDevice={connectedDevice} />

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
        />
      )}

      {/* TELA 3: CONTROLE DE LEDS E RGB */}
      {currentScreen === 'Control' && (
        <ControlScreen
          ledsState={ledsState}
          writeLeds={writeLeds}
          writeRgb={writeRgb}
          setCurrentScreen={setCurrentScreen}
        />
      )}
    </SafeAreaView>
  );
}