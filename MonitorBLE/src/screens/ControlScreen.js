import React from 'react';
import { View, Text, Button, TouchableOpacity } from 'react-native';
import { styles } from '../styles/theme';

export default function ControlScreen({
  ledsState,
  writeLeds,
  writeRgb,
  setCurrentScreen
}) {
  return (
    <View style={styles.screen}>
      <View style={{ width: '100%', alignItems: 'center' }}>
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
      </View>

      <View style={{ width: '100%', marginTop: 'auto' }}>
        <Button
          title="Voltar ao Dashboard"
          onPress={() => setCurrentScreen('Dashboard')}
        />
      </View>
    </View>
  );
}
