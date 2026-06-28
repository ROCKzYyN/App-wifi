import React from 'react';
import { ScrollView, View, Text, Button, TouchableOpacity, Modal } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Svg, { Rect, LinearGradient, Stop, Defs } from 'react-native-svg';
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

// Conversão matemática de HSL para RGB
const hslToRgb = (h, s, l) => {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      let valT = t;
      if (valT < 0) valT += 1;
      if (valT > 1) valT -= 1;
      if (valT < 1 / 6) return p + (q - p) * 6 * valT;
      if (valT < 1 / 2) return q;
      if (valT < 2 / 3) return p + (q - p) * (2 / 3 - valT) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

// Componente de Slider de Gradiente Vetorial (react-native-svg)
function HslSlider({ val, max, setVal, title, gradientColors }) {
  const [width, setWidth] = React.useState(200);

  const handleTouch = (evt) => {
    const x = evt.nativeEvent.locationX;
    const pct = Math.max(0, Math.min(1, x / width));
    const nextVal = Math.round(pct * max);
    setVal(nextVal);
  };

  const cursorX = (val / max) * width;

  return (
    <View style={{ marginVertical: 8, width: '100%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#555' }}>{title}</Text>
        <Text style={{ fontSize: 11, color: '#333', fontWeight: 'bold' }}>{val}</Text>
      </View>
      <View
        onLayout={(evt) => setWidth(evt.nativeEvent.layout.width || 200)}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        style={{ height: 16, position: 'relative', justifyContent: 'center' }}
      >
        <Svg width="100%" height="16" style={{ borderRadius: 8 }}>
          <Defs>
            <LinearGradient id={`grad-${title}`} x1="0%" y1="0%" x2="100%" y2="0%">
              {gradientColors.map((color, idx) => (
                <Stop
                  key={idx}
                  offset={`${(idx / (gradientColors.length - 1)) * 100}%`}
                  stopColor={color}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="16" fill={`url(#grad-${title})`} />
        </Svg>
        <View style={{
          position: 'absolute',
          left: cursorX - 10,
          top: -2,
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2.5,
          borderColor: '#fff',
          backgroundColor: 'transparent',
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 1,
          elevation: 4
        }} pointerEvents="none" />
      </View>
    </View>
  );
}

export default function ControlScreen({
  ledsState,
  writeLeds,
  writeRgb,
  setCurrentScreen,
  rssi,
  rssiHistory
}) {
  const [modalVisible, setModalVisible] = React.useState(false);
  const [hue, setHue] = React.useState(0);         // 0 a 360
  const [sat, setSat] = React.useState(100);       // 0 a 100
  const [light, setLight] = React.useState(50);     // 0 a 100

  // Calcula a cor final ativa em tempo real
  const [valR, valG, valB] = hslToRgb(hue, sat / 100, light / 100);

  // Calcula a cor correspondente para o gradiente de Saturação (matiz pura)
  const [pureR, pureG, pureB] = hslToRgb(hue, 1, 0.5);
  const pureHexColor = `rgb(${pureR}, ${pureG}, ${pureB})`;

  // Calcula a cor correspondente para o gradiente de Brilho (cor saturada)
  const [satR, satG, satB] = hslToRgb(hue, sat / 100, 0.5);
  const satHexColor = `rgb(${satR}, ${satG}, ${satB})`;

  const handleQuickColor = (r, g, b) => {
    if (r === 255 && g === 0 && b === 0) {
      setHue(0); setSat(100); setLight(50);
    } else if (r === 0 && g === 255 && b === 0) {
      setHue(120); setSat(100); setLight(50);
    } else if (r === 0 && g === 0 && b === 255) {
      setHue(240); setSat(100); setLight(50);
    } else if (r === 0 && g === 0 && b === 0) {
      setHue(0); setSat(0); setLight(0);
    }
    writeRgb(r, g, b);
  };

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
          <Text style={styles.ledLabel}>LED Vermelho (Pino 2)</Text>
          <Button
            title={ledsState.led1 ? "DESLIGAR" : "LIGAR"}
            color={ledsState.led1 ? "red" : "green"}
            onPress={() => writeLeds(!ledsState.led1, ledsState.led2)}
          />
        </View>

        <View style={styles.ledControlCard}>
          <Text style={styles.ledLabel}>LED Verde 2 (Pino 15)</Text>
          <Button
            title={ledsState.led2 ? "DESLIGAR" : "LIGAR"}
            color={ledsState.led2 ? "red" : "green"}
            onPress={() => writeLeds(ledsState.led1, !ledsState.led2)}
          />
        </View>

        {/* Seletor de Cores do RGB */}
        <Text style={[styles.chartTitle, { marginTop: 20 }]}>Controle do LED RGB</Text>
        <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, paddingHorizontal: 5 }}>
          {/* Lado Esquerdo: Atalhos Rápidos */}
          <View style={{ flexDirection: 'row', width: '60%', justifyContent: 'space-between', backgroundColor: '#fff', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#eee' }}>
            <TouchableOpacity
              style={[styles.rgbBtn, { backgroundColor: 'red', width: 38, height: 38, borderRadius: 19 }]}
              onPress={() => handleQuickColor(255, 0, 0)}
            />
            <TouchableOpacity
              style={[styles.rgbBtn, { backgroundColor: 'green', width: 38, height: 38, borderRadius: 19 }]}
              onPress={() => handleQuickColor(0, 255, 0)}
            />
            <TouchableOpacity
              style={[styles.rgbBtn, { backgroundColor: 'blue', width: 38, height: 38, borderRadius: 19 }]}
              onPress={() => handleQuickColor(0, 0, 255)}
            />
            <TouchableOpacity
              style={[styles.rgbBtn, { backgroundColor: '#000', borderWidth: 1, borderColor: '#ccc', width: 38, height: 38, borderRadius: 19 }]}
              onPress={() => handleQuickColor(0, 0, 0)}
            />
          </View>

          {/* Lado Direito: Abrir Modal do Color Picker */}
          <TouchableOpacity
            style={{
              width: '35%',
              height: 44,
              backgroundColor: '#007AFF',
              borderRadius: 10,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2
            }}
            onPress={() => setModalVisible(true)}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>OUTRAS CORES</Text>
          </TouchableOpacity>
        </View>

        {/* Modal do Color Picker do Google HSL */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)'
          }}>
            <View style={{
              width: 290,
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: 20,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5
            }}>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 15 }}>Seletor de Cores (Google HSL)</Text>

              {/* Slider 1: Matiz (Hue) - Arco-íris */}
              <HslSlider
                val={hue}
                max={360}
                setVal={setHue}
                title="Matiz (Hue)"
                gradientColors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']}
              />

              {/* Slider 2: Saturação (Saturation) - Cinza para Cor */}
              <HslSlider
                val={sat}
                max={100}
                setVal={setSat}
                title="Saturação"
                gradientColors={['#808080', pureHexColor]}
              />

              {/* Slider 3: Luminosidade (Lightness) - Preto para Cor para Branco */}
              <HslSlider
                val={light}
                max={100}
                setVal={setLight}
                title="Luminosidade"
                gradientColors={['#000000', satHexColor, '#ffffff']}
              />

              {/* Preview e Valores RGB */}
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 15, justifyContent: 'space-between', paddingHorizontal: 10 }}>
                <View>
                  <Text style={{ fontSize: 13, color: '#333', fontWeight: 'bold' }}>
                    RGB: ({valR}, {valG}, {valB})
                  </Text>
                  <Text style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                    HSL: {hue}°, {sat}%, {light}%
                  </Text>
                </View>
                <View style={{
                  width: 55,
                  height: 24,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: '#ccc',
                  backgroundColor: `rgb(${valR}, ${valG}, ${valB})`
                }} />
              </View>

              {/* Botões do Rodapé */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    marginRight: 10,
                    borderRadius: 10,
                    backgroundColor: '#E0E0E0',
                    alignItems: 'center'
                  }}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={{ color: '#333', fontWeight: 'bold', fontSize: 13 }}>CANCELAR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: '#007AFF',
                    alignItems: 'center'
                  }}
                  onPress={() => {
                    writeRgb(valR, valG, valB);
                    setModalVisible(false);
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>ENVIAR COR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
