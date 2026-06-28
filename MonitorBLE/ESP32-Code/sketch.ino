#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "secrets.h"

struct Button {
  uint8_t pin;
  bool stable;
  bool lastRaw;
  uint32_t tMs;
};

// HARDWARE MAPPING (Idêntico ao projeto original)
#define DHT_PIN        18
#define DHT_TYPE       DHT22
#define LED1_PIN       2
#define LED2_PIN       15
#define LED_R_PIN      17
#define LED_G_PIN      16
#define LED_B_PIN      4

#define BTN_SCREEN_PIN 26
#define BTN_RESET_PIN  27
#define SW_BLOCK_PIN   34
#define SW_LED1_PIN    32
#define SW_LED2_PIN    35
#define SW_UNIT_PIN    33

#define RGB_COMMON_ANODE   false

// Configurações de Frequência
const uint32_t DHT_READ_MS      = 2000;
const uint32_t LCD_AUTO_MS      = 3000; // Alterna tela a cada 3s automaticamente
const uint32_t SEND_TELEMETRIA_MS = 5000; // Envia telemetria a cada 5s (máximo da especificação)
const uint32_t DEBOUNCE_MS      = 40;
const uint8_t  HISTORY_SIZE     = 60;   // Vetor de médias dos últimos 60 minutos
const uint32_t HISTORY_SLOT_MS  = 60000; // Cada slot representa 1 minuto (60000ms)
const uint32_t HISTORY_PUB_MS   = 300000; // Publica histórico periodicamente a cada 5 minutos

DHT dht(DHT_PIN, DHT_TYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ESTADOS DO SISTEMA
float curTempC = NAN, curTempF = NAN, curHum = NAN;
float minTempC = NAN, maxTempC = NAN, minHum = NAN, maxHum = NAN;

float histTemp[HISTORY_SIZE];
float histHum[HISTORY_SIZE];
uint8_t histCount = 0;

double accTemp = 0, accHum = 0;
uint32_t accN = 0;
uint32_t lastHistMs = 0;
uint32_t lastHistPubMs = 0;

bool led1On = false, led2On = false;
uint8_t rgbR = 0, rgbG = 0, rgbB = 0;

bool swBlock = false;
bool swLed1  = false;
bool swLed2  = false;
bool swUnit  = false;
bool lastSwLed1 = false, lastSwLed2 = false, lastSwBlock = false, lastSwUnit = false;

uint8_t lcdScreen = 0;
uint8_t lastRenderedScreen = 255;
const uint8_t LCD_SCREENS = 5;
uint32_t lastLcdMs = 0;

uint32_t lastDhtMs = 0;
uint32_t lastSendMs = 0;

Button btnScreen{BTN_SCREEN_PIN, false, false, 0};
Button btnReset {BTN_RESET_PIN,  false, false, 0};

// MÁQUINA DE ESTADOS DO WI-FI
enum WifiState {
  WIFI_STATE_INIT,
  WIFI_STATE_CONNECTING,
  WIFI_STATE_CONNECTED,
  WIFI_STATE_RECONNECTING
};

WifiState wifiState = WIFI_STATE_INIT;
uint32_t lastWifiStateMs = 0;
const uint32_t WIFI_TIMEOUT_MS = 10000;
const uint32_t WIFI_RECONNECT_COOLDOWN_MS = 5000;

// CLIENTE MQTT
WiFiClient espClient;
PubSubClient mqttClient(espClient);

uint32_t lastMqttRetryMs = 0;
const uint32_t MQTT_RETRY_INTERVAL_MS = 5000;

// Tópicos MQTT (Construídos dinamicamente)
String topicStatus;
String topicTempCelsius;
String topicTempFahrenheit;
String topicTempMin;
String topicTempMax;
String topicHumidity;
String topicHumMin;
String topicHumMax;
String topicRssi;
String topicHistory;
String topicHistoryReq;
String topicLedsEstado;
String topicLedsComando;
String topicRgbComando;
String topicControleBloqueio;
String topicControleReset;
String topicControleUnidade;

// Declarações de funções
void applyLed1();
void applyLed2();
void setLed1(bool s);
void setLed2(bool s);
void setRgb(uint8_t r, uint8_t g, uint8_t b);
void resetMinMax();
void pushHistorySlot(float t, float h);
void readSensor();
void renderLcd();
void goToScreen(uint8_t s);
void nextScreen();
bool pressedEdge(Button &b);
void readSwitches();
void handleNetwork();
void handleMqtt();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void publishTelemetry();
void publishHistory();
void publishLedsState();
void publishBlockState();
void publishUnitState();

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== ESP32 MONITOR AMBIENTAL (Wi-Fi & MQTT) ===");

  // Tópicos dinâmicos com base em secrets.h
  topicStatus           = String(MQTT_PREFIX) + "/status";
  topicTempCelsius      = String(MQTT_PREFIX) + "/temperatura/celsius";
  topicTempFahrenheit   = String(MQTT_PREFIX) + "/temperatura/fahrenheit";
  topicTempMin          = String(MQTT_PREFIX) + "/temperatura/min";
  topicTempMax          = String(MQTT_PREFIX) + "/temperatura/max";
  topicHumidity         = String(MQTT_PREFIX) + "/umidade";
  topicHumMin           = String(MQTT_PREFIX) + "/umidade/min";
  topicHumMax           = String(MQTT_PREFIX) + "/umidade/max";
  topicRssi             = String(MQTT_PREFIX) + "/rssi";
  topicHistory          = String(MQTT_PREFIX) + "/historico";
  topicHistoryReq       = String(MQTT_PREFIX) + "/historico/requisicao";
  topicLedsEstado       = String(MQTT_PREFIX) + "/leds/estado";
  topicLedsComando      = String(MQTT_PREFIX) + "/leds/comando";
  topicRgbComando       = String(MQTT_PREFIX) + "/rgb/comando";
  topicControleBloqueio = String(MQTT_PREFIX) + "/controle/bloqueio";
  topicControleReset    = String(MQTT_PREFIX) + "/controle/reset";
  topicControleUnidade  = String(MQTT_PREFIX) + "/controle/unidade";

  // Configuração dos Pinos dos LEDs e RGB
  pinMode(LED1_PIN, OUTPUT); 
  pinMode(LED2_PIN, OUTPUT);
  digitalWrite(LED1_PIN, LOW); 
  digitalWrite(LED2_PIN, LOW);

  ledcAttach(LED_R_PIN, 5000, 8);
  ledcAttach(LED_G_PIN, 5000, 8);
  ledcAttach(LED_B_PIN, 5000, 8);
  setRgb(0, 0, 0);

  // Configuração dos Pinos de Entrada (Botoes e Chaves)
  pinMode(BTN_SCREEN_PIN, INPUT);
  pinMode(BTN_RESET_PIN,  INPUT);
  pinMode(SW_BLOCK_PIN,   INPUT);
  pinMode(SW_LED1_PIN,    INPUT);
  pinMode(SW_LED2_PIN,    INPUT);
  pinMode(SW_UNIT_PIN,    INPUT);

  // Inicialização do LCD
  Wire.begin();
  Wire.setClock(100000);
  lcd.init(); 
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0); 
  lcd.print("ESP32 MONITOR");
  lcd.setCursor(0, 1); 
  lcd.print("Inicializando...");

  // Inicialização de valores padrão (segurança para simulação no Wokwi)
  curTempC = 25.0; 
  curTempF = 77.0; 
  curHum = 50.0;
  minTempC = maxTempC = 25.0; 
  minHum = maxHum = 50.0;

  dht.begin();
  
  lcd.clear();
  goToScreen(0);

  // Configurações do Cliente MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  
  // Aumenta o buffer para 1024 bytes para enviar o JSON de histórico (vetor de médias)
  mqttClient.setBufferSize(1024);

  uint32_t now = millis();
  lastDhtMs = lastSendMs = lastLcdMs = lastHistMs = lastHistPubMs = now;
}

void loop() {
  uint32_t now = millis();

  // Executa máquina de estados de rede (Wi-Fi + MQTT) sem bloquear o loop
  handleNetwork();

  // 1. Trata Botões Físicos
  if (pressedEdge(btnScreen)) {
    nextScreen();
  }
  if (pressedEdge(btnReset)) { 
    resetMinMax(); 
    renderLcd();
    Serial.println("[PB2] Histórico de Min/Max resetado localmente"); 
    if (mqttClient.connected()) {
      publishTelemetry();
    }
  }

  // 2. Trata Chaves Estáticas (Switches)
  readSwitches();

  // 3. Lê Sensor DHT22 (a cada 2 segundos)
  if (now - lastDhtMs >= DHT_READ_MS) {
    lastDhtMs = now;
    readSensor();
    if (lcdScreen <= 3) {
      renderLcd();
    }
  }

  // 4. Acumula médias para o histórico (a cada 1 minuto)
  if (now - lastHistMs >= HISTORY_SLOT_MS) {
    lastHistMs = now;
    if (accN > 0) { 
      pushHistorySlot(accTemp/accN, accHum/accN); 
      accTemp = accHum = 0; 
      accN = 0; 
    }
  }

  // 5. Publica Histórico Periodicamente (a cada 5 minutos)
  if (now - lastHistPubMs >= HISTORY_PUB_MS) {
    lastHistPubMs = now;
    publishHistory();
  }

  // 6. Envia Telemetria Periódica MQTT (a cada 5 segundos)
  if (now - lastSendMs >= SEND_TELEMETRIA_MS) {
    lastSendMs = now;
    publishTelemetry();
    if (lcdScreen == 4) {
      renderLcd(); // Atualiza a tela de status (RSSI)
    }
  }

  // 7. Alternância automática de tela LCD (a cada 3 segundos)
  if (now - lastLcdMs >= LCD_AUTO_MS) {
    lastLcdMs = now;
    nextScreen();
  }
}

// MÁQUINA DE ESTADOS NÃO BLOQUEANTE DE CONEXÃO
void handleNetwork() {
  uint32_t now = millis();

  switch (wifiState) {
    case WIFI_STATE_INIT:
      Serial.print("[WiFi] Conectando ao SSID: ");
      Serial.println(WIFI_SSID);
      WiFi.mode(WIFI_STA);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      wifiState = WIFI_STATE_CONNECTING;
      lastWifiStateMs = now;
      if (lcdScreen == 4) renderLcd();
      break;

    case WIFI_STATE_CONNECTING:
      if (WiFi.status() == WL_CONNECTED) {
        Serial.print("[WiFi] Conectado com sucesso! Endereço IP: ");
        Serial.println(WiFi.localIP());
        wifiState = WIFI_STATE_CONNECTED;
        lastWifiStateMs = now;
        if (lcdScreen == 4) renderLcd();
      } else if (now - lastWifiStateMs >= WIFI_TIMEOUT_MS) {
        Serial.println("[WiFi] Falha de conexão: Timeout de 10s. Tentando novamente mais tarde.");
        WiFi.disconnect();
        wifiState = WIFI_STATE_RECONNECTING;
        lastWifiStateMs = now;
        if (lcdScreen == 4) renderLcd();
      }
      break;

    case WIFI_STATE_CONNECTED:
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Conexão Wi-Fi perdida!");
        wifiState = WIFI_STATE_RECONNECTING;
        lastWifiStateMs = now;
        if (lcdScreen == 4) renderLcd();
      } else {
        // Se Wi-Fi estiver ok, processa cliente MQTT
        handleMqtt();
      }
      break;

    case WIFI_STATE_RECONNECTING:
      if (now - lastWifiStateMs >= WIFI_RECONNECT_COOLDOWN_MS) {
        wifiState = WIFI_STATE_INIT;
      }
      break;
  }
}

// CLIENTE MQTT NÃO BLOQUEANTE
void handleMqtt() {
  if (mqttClient.connected()) {
    mqttClient.loop();
    return;
  }

  uint32_t now = millis();
  if (now - lastMqttRetryMs >= MQTT_RETRY_INTERVAL_MS) {
    lastMqttRetryMs = now;
    Serial.println("[MQTT] Tentando estabelecer conexão com o Broker...");

    // Cria ID exclusivo com o MAC para evitar clonagem
    String clientId = "ESP32Client-" + WiFi.macAddress();
    clientId.replace(":", "");

    // Conecta com LWT (Last Will and Testament) no tópico de status
    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, topicStatus.c_str(), 1, true, "offline")) {
      Serial.println("[MQTT] Conectado ao Broker!");
      
      // Envia status online
      mqttClient.publish(topicStatus.c_str(), "online", true);

      // Subscreve nos tópicos de comandos remotos
      mqttClient.subscribe(topicLedsComando.c_str());
      mqttClient.subscribe(topicRgbComando.c_str());
      mqttClient.subscribe(topicControleReset.c_str());
      mqttClient.subscribe(topicHistoryReq.c_str());

      // Sincroniza estados iniciais com a nuvem
      publishLedsState();
      publishBlockState();
      publishUnitState();
      publishHistory();
      if (lcdScreen == 4) renderLcd();
    } else {
      Serial.printf("[MQTT] Falha de conexão. Estado rc = %d. Nova tentativa em 5s.\n", mqttClient.state());
    }
  }
}

// CALLBACK DE PROCESSAMENTO DE MENSAGENS MQTT (DASHBOARD -> ESP32)
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char payloadStr[length + 1];
  memcpy(payloadStr, payload, length);
  payloadStr[length] = '\0';

  Serial.printf("[MQTT Callback] Tópico: %s | Payload: %s\n", topic, payloadStr);

  // 1. Comando dos LEDs Simples
  if (String(topic) == topicLedsComando) {
    if (swBlock) {
      Serial.println("[MQTT Callback] Comando de LEDs ignorado: Controle Local ativo!");
      publishLedsState(); // Atualiza dashboard com estado físico atual
      return;
    }

    if (strstr(payloadStr, "\"led1\":true")) {
      setLed1(true);
    } else if (strstr(payloadStr, "\"led1\":false")) {
      setLed1(false);
    }

    if (strstr(payloadStr, "\"led2\":true")) {
      setLed2(true);
    } else if (strstr(payloadStr, "\"led2\":false")) {
      setLed2(false);
    }
    publishLedsState();
  }
  // 2. Comando de Cor do LED RGB ("R,G,B")
  else if (String(topic) == topicRgbComando) {
    int r = 0, g = 0, b = 0;
    if (sscanf(payloadStr, "%d,%d,%d", &r, &g, &b) == 3) {
      setRgb(r, g, b);
    }
  }
  // 3. Comando de Reset do Histórico
  else if (String(topic) == topicControleReset) {
    resetMinMax();
    renderLcd();
    Serial.println("[MQTT Callback] Histórico resetado via comando remoto");
    publishTelemetry();
  }
  // 4. Solicitação de Histórico Sob Demanda
  else if (String(topic) == topicHistoryReq) {
    publishHistory();
    Serial.println("[MQTT Callback] Histórico publicado sob demanda");
  }
}

// FUNÇÕES DE TELEMETRIA
void publishTelemetry() {
  if (!mqttClient.connected()) return;

  if (!isnan(curTempC)) {
    char tempCStr[8];
    snprintf(tempCStr, sizeof(tempCStr), "%.1f", curTempC);
    mqttClient.publish(topicTempCelsius.c_str(), tempCStr);
  }

  if (!isnan(curTempF)) {
    char tempFStr[8];
    snprintf(tempFStr, sizeof(tempFStr), "%.1f", curTempF);
    mqttClient.publish(topicTempFahrenheit.c_str(), tempFStr);
  }

  if (!isnan(minTempC)) {
    char minTempStr[8];
    snprintf(minTempStr, sizeof(minTempStr), "%.1f", minTempC);
    mqttClient.publish(topicTempMin.c_str(), minTempStr);
  }

  if (!isnan(maxTempC)) {
    char maxTempStr[8];
    snprintf(maxTempStr, sizeof(maxTempStr), "%.1f", maxTempC);
    mqttClient.publish(topicTempMax.c_str(), maxTempStr);
  }

  if (!isnan(curHum)) {
    char humStr[8];
    snprintf(humStr, sizeof(humStr), "%.1f", curHum);
    mqttClient.publish(topicHumidity.c_str(), humStr);
  }

  if (!isnan(minHum)) {
    char minHumStr[8];
    snprintf(minHumStr, sizeof(minHumStr), "%.1f", minHum);
    mqttClient.publish(topicHumMin.c_str(), minHumStr);
  }

  if (!isnan(maxHum)) {
    char maxHumStr[8];
    snprintf(maxHumStr, sizeof(maxHumStr), "%.1f", maxHum);
    mqttClient.publish(topicHumMax.c_str(), maxHumStr);
  }

  // RSSI do Wi-Fi
  int rssi = WiFi.RSSI();
  char rssiStr[8];
  snprintf(rssiStr, sizeof(rssiStr), "%d", rssi);
  mqttClient.publish(topicRssi.c_str(), rssiStr);
}

void publishHistory() {
  if (!mqttClient.connected()) return;

  char buffer[1024];
  int pos = 0;
  
  pos += snprintf(buffer + pos, sizeof(buffer) - pos, "{\"temp\":[");
  for (int i = 0; i < histCount; i++) {
    pos += snprintf(buffer + pos, sizeof(buffer) - pos, "%.1f%s", histTemp[i], (i == histCount - 1) ? "" : ",");
  }
  pos += snprintf(buffer + pos, sizeof(buffer) - pos, "],\"hum\":[");
  for (int i = 0; i < histCount; i++) {
    pos += snprintf(buffer + pos, sizeof(buffer) - pos, "%.1f%s", histHum[i], (i == histCount - 1) ? "" : ",");
  }
  pos += snprintf(buffer + pos, sizeof(buffer) - pos, "]}");

  mqttClient.publish(topicHistory.c_str(), buffer, true);
}

void publishLedsState() {
  if (!mqttClient.connected()) return;
  char buffer[48];
  snprintf(buffer, sizeof(buffer), "{\"led1\":%s,\"led2\":%s}", led1On ? "true" : "false", led2On ? "true" : "false");
  mqttClient.publish(topicLedsEstado.c_str(), buffer, true);
}

void publishBlockState() {
  if (!mqttClient.connected()) return;
  const char* val = swBlock ? "local" : "remote";
  mqttClient.publish(topicControleBloqueio.c_str(), val, true);
}

void publishUnitState() {
  if (!mqttClient.connected()) return;
  const char* val = swUnit ? "F" : "C";
  mqttClient.publish(topicControleUnidade.c_str(), val, true);
}

// CONTROLE FÍSICO DOS LEDS E RGB
void applyLed1() { digitalWrite(LED1_PIN, led1On ? HIGH : LOW); }
void applyLed2() { digitalWrite(LED2_PIN, led2On ? HIGH : LOW); }
void setLed1(bool s) { led1On = s; applyLed1(); }
void setLed2(bool s) { led2On = s; applyLed2(); }

void setRgb(uint8_t r, uint8_t g, uint8_t b) {
  rgbR = r; rgbG = g; rgbB = b;
  #if RGB_COMMON_ANODE
  uint8_t pr = 255 - r, pg = 255 - g, pb = 255 - b;
  #else
  uint8_t pr = r, pg = g, pb = b;
  #endif
  ledcWrite(LED_R_PIN, pr);
  ledcWrite(LED_G_PIN, pg);
  ledcWrite(LED_B_PIN, pb);
}

void resetMinMax() {
  minTempC = maxTempC = curTempC;
  minHum   = maxHum   = curHum;
}

void pushHistorySlot(float t, float h) {
  if (histCount < HISTORY_SIZE) {
    histTemp[histCount] = t; 
    histHum[histCount] = h; 
    histCount++;
  } else {
    for (uint8_t i = 1; i < HISTORY_SIZE; i++) {
      histTemp[i-1] = histTemp[i]; 
      histHum[i-1] = histHum[i];
    }
    histTemp[HISTORY_SIZE-1] = t; 
    histHum[HISTORY_SIZE-1] = h;
  }
  // Publica o histórico atualizado
  publishHistory();
}

void readSensor() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("[DHT22] Erro na leitura do sensor!");
    return;
  }
  curTempC = t;
  curTempF = t * 9.0 / 5.0 + 32.0;
  curHum   = h;

  if (isnan(minTempC)) resetMinMax();
  if (t < minTempC) minTempC = t;
  if (t > maxTempC) maxTempC = t;
  if (h < minHum)   minHum   = h;
  if (h > maxHum)   maxHum   = h;

  accTemp += t; 
  accHum += h; 
  accN++;
}

void lcdLine(uint8_t row, const String& s) {
  String t = s;
  while (t.length() < 16) t += ' ';
  if (t.length() > 16) t = t.substring(0, 16);
  lcd.setCursor(0, row);
  lcd.print(t);
}

void renderLcd() {
  char l0[24], l1[24];
  switch (lcdScreen) {
    case 0:
      snprintf(l0, sizeof(l0), "Temp: %.1f%cC", isnan(curTempC)?0:curTempC, (char)223);
      snprintf(l1, sizeof(l1), "Umid: %.1f%%",  isnan(curHum)?0:curHum);
      break;
    case 1:
      snprintf(l0, sizeof(l0), "Temp: %.1f%cF", isnan(curTempF)?0:curTempF, (char)223);
      snprintf(l1, sizeof(l1), "Umid: %.1f%%",  isnan(curHum)?0:curHum);
      break;
    case 2:
      snprintf(l0, sizeof(l0), "Tmin:%.1f%cC", isnan(minTempC)?0:minTempC, (char)223);
      snprintf(l1, sizeof(l1), "Tmax:%.1f%cC", isnan(maxTempC)?0:maxTempC, (char)223);
      break;
    case 3:
      snprintf(l0, sizeof(l0), "Hmin:%.1f%%", isnan(minHum)?0:minHum);
      snprintf(l1, sizeof(l1), "Hmax:%.1f%%", isnan(maxHum)?0:maxHum);
      break;
    case 4: {
      const char* wifiStr = (wifiState == WIFI_STATE_CONNECTED) ? "WiFi: Conectado" : 
                            (wifiState == WIFI_STATE_CONNECTING) ? "WiFi: Conectando" : "WiFi: Desc.";
      const char* mqttStr = mqttClient.connected() ? "MQTT: Conectado" : "MQTT: Desc.";
      snprintf(l0, sizeof(l0), "%s", wifiStr);
      if (wifiState == WIFI_STATE_CONNECTED) {
        snprintf(l1, sizeof(l1), "%s (%d)", mqttStr, WiFi.RSSI());
      } else {
        snprintf(l1, sizeof(l1), "%s", mqttStr);
      }
      break;
    }
    default:
      l0[0] = l1[0] = '\0';
      break;
  }
  lcdLine(0, l0);
  lcdLine(1, l1);
  lastRenderedScreen = lcdScreen;
}

void goToScreen(uint8_t s) {
  lcdScreen = s % LCD_SCREENS;
  lastLcdMs = millis();
  renderLcd();
}

void nextScreen() {
  goToScreen(lcdScreen + 1);
}

bool pressedEdge(Button &b) {
  bool pressedRaw = (digitalRead(b.pin) == HIGH);
  uint32_t now = millis();
  if (pressedRaw != b.lastRaw) { 
    b.lastRaw = pressedRaw; 
    b.tMs = now; 
  }
  if ((now - b.tMs) > DEBOUNCE_MS && pressedRaw != b.stable) {
    b.stable = pressedRaw;
    if (b.stable) return true;
  }
  return false;
}

void readSwitches() {
  bool nBlock = (digitalRead(SW_BLOCK_PIN) == HIGH);
  bool nLed1  = (digitalRead(SW_LED1_PIN)  == HIGH);
  bool nLed2  = (digitalRead(SW_LED2_PIN)  == HIGH);
  bool nUnit  = (digitalRead(SW_UNIT_PIN)  == HIGH);

  swBlock = nBlock; 
  swLed1 = nLed1; 
  swLed2 = nLed2; 
  swUnit = nUnit;

  // Se houver alteração nas chaves locais dos LEDs simples
  if (swLed1 != lastSwLed1) { 
    lastSwLed1 = swLed1; 
    setLed1(swLed1); 
    publishLedsState(); 
  }
  if (swLed2 != lastSwLed2) { 
    lastSwLed2 = swLed2; 
    setLed2(swLed2); 
    publishLedsState(); 
  }

  // Se houver alteração na chave de bloqueio de controle remoto
  if (swBlock != lastSwBlock) {
    lastSwBlock = swBlock;
    publishBlockState();
    Serial.printf("[Switch] Bloqueio Remoto alterado para: %s\n", swBlock ? "ATIVO" : "INATIVO");
  }

  // Se houver alteração na chave de unidade de temperatura do gráfico
  if (swUnit != lastSwUnit) {
    lastSwUnit = swUnit;
    publishUnitState();
    Serial.printf("[Switch] Visualização Remota alterada para: %s\n", swUnit ? "Fahrenheit" : "Celsius");
  }
}