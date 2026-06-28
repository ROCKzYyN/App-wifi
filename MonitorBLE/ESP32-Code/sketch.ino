    #include <Arduino.h>
    #include <Wire.h>
    #include <LiquidCrystal_I2C.h>
    #include <DHT.h>

    // Bibliotecas Oficiais do ESP32 para BLE e Segurança
    #include <BLEDevice.h>
    #include <BLEServer.h>
    #include <BLEUtils.h>
    #include <BLE2902.h>

    struct Button {
    uint8_t pin;
    bool stable;
    bool lastRaw;
    uint32_t tMs;
    };

    // --- CONFIGURAÇÃO DOS UUIDs DA TABELA GATT ---
    #define SERVICE_UUID           "4FAFC201-1FB5-459E-8FCC-C5C9C331914B"
    #define CHAR_TELEMETRY_UUID    "4FAFC202-1FB5-459E-8FCC-C5C9C331914B" 
    #define CHAR_LEDS_UUID         "4FAFC203-1FB5-459E-8FCC-C5C9C331914B" 
    #define CHAR_RGB_UUID          "4FAFC204-1FB5-459E-8FCC-C5C9C331914B" 
    #define CHAR_COMMAND_UUID      "4FAFC205-1FB5-459E-8FCC-C5C9C331914B" 

    // --- HARDWARE MAPPING ---
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
    #define SIMULADOR_WOKWI true  // Mude para false antes de entregar 

    const uint32_t DHT_READ_MS      = 2000;
    const uint32_t LCD_AUTO_MS      = 5000;
    const uint32_t SEND_MS          = 1500; 
    const uint32_t DEBOUNCE_MS      = 40;
    const uint8_t  HISTORY_SIZE     = 60;
    const uint32_t HISTORY_SLOT_MS  = 60000;

    DHT dht(DHT_PIN, DHT_TYPE);
    LiquidCrystal_I2C lcd(0x27, 16, 2);

    // --- ESTADOS DO SISTEMA ---
    float curTempC = NAN, curTempF = NAN, curHum = NAN;
    float minTempC = NAN, maxTempC = NAN, minHum = NAN, maxHum = NAN;

    float histTemp[HISTORY_SIZE];
    float histHum[HISTORY_SIZE];
    uint8_t histCount = 0;

    double accTemp = 0, accHum = 0;
    uint32_t accN = 0;
    uint32_t lastHistMs = 0;

    bool led1On = false, led2On = false;
    uint8_t rgbR = 0, rgbG = 0, rgbB = 0;

    bool swBlock = false;
    bool swLed1  = false;
    bool swLed2  = false;
    bool swUnit  = false;
    bool lastSwLed1 = false, lastSwLed2 = false;

    uint8_t lcdScreen = 0;
    uint8_t lastRenderedScreen = 255;
    const uint8_t LCD_SCREENS = 5;
    uint32_t lastLcdMs = 0;

    uint32_t lastDhtMs = 0;
    uint32_t lastSendMs = 0;

    Button btnScreen{BTN_SCREEN_PIN, false, false, 0};
    Button btnReset {BTN_RESET_PIN,  false, false, 0};

    // --- INSTÂNCIAS E CALLBACKS DO BLE ---
    BLEServer* pServer = nullptr;
    BLECharacteristic* pCharTelemetry = nullptr;
    BLECharacteristic* pCharLeds = nullptr;
    BLECharacteristic* pCharRgb = nullptr;
    BLECharacteristic* pCharCommand = nullptr;
    bool deviceConnected = false;
    int curRssi = 0; // Armazena a intensidade do sinal recebida do App

    bool remoteLocked() { return swBlock; }

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
        histTemp[histCount] = t; histHum[histCount] = h; histCount++;
    } else {
        for (uint8_t i = 1; i < HISTORY_SIZE; i++) {
        histTemp[i-1] = histTemp[i]; histHum[i-1] = histHum[i];
        }
        histTemp[HISTORY_SIZE-1] = t; histHum[HISTORY_SIZE-1] = h;
    }
    }

    void readSensor() {
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (isnan(h) || isnan(t)) {
        Serial.println("[DHT] Falha de leitura");
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

    accTemp += t; accHum += h; accN++;
    }

    const char* netStateStr() { return deviceConnected ? "Conectado" : "Desconectado"; }

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
        case 4:
        snprintf(l0, sizeof(l0), "BLE: %s", netStateStr());
        if (deviceConnected && curRssi != 0) {
            snprintf(l1, sizeof(l1), "Sinal: %d dBm", curRssi);
        } else {
            snprintf(l1, sizeof(l1), "Aguardando APP...");
        }
        break;
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
    if (pressedRaw != b.lastRaw) { b.lastRaw = pressedRaw; b.tMs = now; }
    if ((now - b.tMs) > DEBOUNCE_MS && pressedRaw != b.stable) {
        b.stable = pressedRaw;
        if (b.stable) return true;
    }
    return false;
    }

    void updateBleLedsState() {
    if (deviceConnected) {
        uint8_t payload[2] = { (uint8_t)led1On, (uint8_t)led2On };
        pCharLeds->setValue(payload, 2);
    }
    }

    void readSwitches() {
    bool nBlock = (digitalRead(SW_BLOCK_PIN) == HIGH);
    bool nLed1  = (digitalRead(SW_LED1_PIN)  == HIGH);
    bool nLed2  = (digitalRead(SW_LED2_PIN)  == HIGH);
    bool nUnit  = (digitalRead(SW_UNIT_PIN)  == HIGH);

    swBlock=nBlock; swLed1=nLed1; swLed2=nLed2; swUnit=nUnit;

    if (swLed1 != lastSwLed1) { lastSwLed1 = swLed1; setLed1(swLed1); updateBleLedsState(); }
    if (swLed2 != lastSwLed2) { lastSwLed2 = swLed2; setLed2(swLed2); updateBleLedsState(); }
    }

    // --- CALL BACKS DE CONEXÃO SERVER BLE ---
    class ServerCallbacks: public BLEServerCallbacks {
        void onConnect(BLEServer* pServer, esp_ble_gatts_cb_param_t* param) { // <--(EU DO FUTURO) se der pau no conetc remover o esp_ble_gatts_cb_param_t* param
        deviceConnected = true;
        Serial.println("[BLE] Smartphone conectado!");
        if (lcdScreen == 4) renderLcd();
        }
        void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
        curRssi = 0; // Zera o RSSI na desconexão
        Serial.println("[BLE] Smartphone desconectado. Reiniciando Advertising...");
        pServer->startAdvertising(); 
        if (lcdScreen == 4) renderLcd();
        }
    };

    // --- CALLBACKS DE ESCRITA (DASHBOARD -> ESP32) ---
    class LedsWriteCallback: public BLECharacteristicCallbacks {
        void onWrite(BLECharacteristic *pCharacteristic) {
        if (remoteLocked()) {
            Serial.println("[BLE] Escrita LEDs Bloqueada pelo Switch Físico!");
            updateBleLedsState();
            return;
        }
        uint8_t* data = pCharacteristic->getData();
        if (pCharacteristic->getLength() >= 2) {
            setLed1(data[0] != 0);
            setLed2(data[1] != 0);
            Serial.printf("[BLE] Controle Remoto -> LED1: %d, LED2: %d\n", led1On, led2On);
        }
        }
    };

    class RgbWriteCallback: public BLECharacteristicCallbacks {
        void onWrite(BLECharacteristic *pCharacteristic) {
        uint8_t* data = pCharacteristic->getData();
        if (pCharacteristic->getLength() >= 3) {
            setRgb(data[0], data[1], data[2]);
            Serial.printf("[BLE] Cor RGB Atualizada -> R:%d G:%d B:%d\n", data[0], data[1], data[2]);
        }
        }
    };

    class CommandCallback: public BLECharacteristicCallbacks {
        void onWrite(BLECharacteristic *pCharacteristic) {
        uint8_t* data = pCharacteristic->getData();
        if (pCharacteristic->getLength() >= 1) {
            uint8_t cmd = data[0];
            if (cmd == 1) {
            resetMinMax();
            renderLcd();
            Serial.println("[BLE] Comando recebido: Reset Min/Max");
            } else if (cmd == 2) {
            nextScreen();
            Serial.println("[BLE] Comando recebido: Próxima Tela LCD");
            } else if (cmd == 3 && pCharacteristic->getLength() >= 2) {
            curRssi = -((int)data[1]); // Recebe o valor absoluto e inverte para negativo
            if (lcdScreen == 4) renderLcd();
            Serial.printf("[BLE] Comando recebido: RSSI Atualizado para %d dBm\n", curRssi);
            }
        }
        }
    };

    // --- ENVIO PERIÓDICO DE TELEMETRIA POR NOTIFICAÇÃO BLE ---
    void sendTelemetryBle() {
    if (!deviceConnected) return;

    uint8_t payload[20]; // Fixado em 20 bytes para alinhar perfeitamente com o useBLE.js atual
    memcpy(&payload[0],  &curTempC, 4);
    memcpy(&payload[4],  &curHum,   4);
    memcpy(&payload[8],  &minTempC, 4);
    memcpy(&payload[12], &maxTempC, 4);
    memcpy(&payload[16], &minHum,   4);

    pCharTelemetry->setValue(payload, 20);
    pCharTelemetry->notify(); 
    }

    void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== ESP32 MONITOR AMBIENTAL (NATIVE BLE) ===");

  pinMode(LED1_PIN, OUTPUT); pinMode(LED2_PIN, OUTPUT);
  digitalWrite(LED1_PIN, LOW); digitalWrite(LED2_PIN, LOW);

  ledcAttach(LED_R_PIN, 5000, 8);
  ledcAttach(LED_G_PIN, 5000, 8);
  ledcAttach(LED_B_PIN, 5000, 8);
  setRgb(0, 0, 0);

  pinMode(BTN_SCREEN_PIN, INPUT);
  pinMode(BTN_RESET_PIN,  INPUT);
  pinMode(SW_LED1_PIN,    INPUT);
  pinMode(SW_UNIT_PIN,    INPUT);
  pinMode(SW_BLOCK_PIN,   INPUT);
  pinMode(SW_LED2_PIN,    INPUT);

  Wire.begin();
  Wire.setClock(100000);
  lcd.init(); lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("ESP32 MONITOR");
  lcd.setCursor(0, 1); lcd.print("Inicializando...");

  // Inicialização manual segura para evitar o bug do DHT no Wokwi
  curTempC = 25.0; curTempF = 77.0; curHum = 50.0;
  minTempC = maxTempC = 25.0; minHum = maxHum = 50.0;

  dht.begin();
  
  lcd.clear();
  goToScreen(0);

  // --- SEPARAÇÃO LÓGICA: SÓ LIGA O BLE SE NÃO FOR NO WOKWI ---
  #if !SIMULADOR_WOKWI
    BLEDevice::init("ESP32_Monitor_BLE");
    
    BLESecurity *pSecurity = new BLESecurity();
    pSecurity->setAuthenticationMode(ESP_LE_AUTH_BOND);
    pSecurity->setCapability(ESP_IO_CAP_NONE);

    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());
    
    BLEService *pService = pServer->createService(SERVICE_UUID);

    pCharTelemetry = pService->createCharacteristic(
                           CHAR_TELEMETRY_UUID,
                           BLECharacteristic::PROPERTY_NOTIFY
                         );
    pCharTelemetry->addDescriptor(new BLE2902());

    pCharLeds = pService->createCharacteristic(
                    CHAR_LEDS_UUID,
                    BLECharacteristic::PROPERTY_READ | 
                    BLECharacteristic::PROPERTY_WRITE
                  );
    pCharLeds->setCallbacks(new LedsWriteCallback());

    pCharRgb = pService->createCharacteristic(
                   CHAR_RGB_UUID,
                   BLECharacteristic::PROPERTY_WRITE
                 );
    pCharRgb->setCallbacks(new RgbWriteCallback());

    pCharCommand = pService->createCharacteristic(
                       CHAR_COMMAND_UUID,
                       BLECharacteristic::PROPERTY_WRITE
                     );
    pCharCommand->setCallbacks(new CommandCallback());

    pService->start();

    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
    
    Serial.println("[BLE] Servidor pronto na placa física!");
  #else
    Serial.println("[WOKWI MOCK] Modo Simulador Ativo. BLE Desativado para evitar Watchdog Reset.");
  #endif

  uint32_t now = millis();
  lastDhtMs = lastSendMs = lastLcdMs = lastHistMs = now;
}

    void loop() {
    uint32_t now = millis();

    if (pressedEdge(btnScreen)) nextScreen();
    if (pressedEdge(btnReset)) { 
        resetMinMax(); 
        renderLcd();
        Serial.println("[PB2] reset min/max"); 
    }

    readSwitches();

    if (now - lastDhtMs >= DHT_READ_MS) {
        lastDhtMs = now;
        readSensor();
        if (lcdScreen <= 3) renderLcd();
    }

    if (now - lastHistMs >= HISTORY_SLOT_MS) {
        lastHistMs = now;
        if (accN > 0) { 
        pushHistorySlot(accTemp/accN, accHum/accN); 
        accTemp = accHum = 0; 
        accN = 0; 
        }
    }

    if (now - lastSendMs >= SEND_MS) {
        lastSendMs = now;
        sendTelemetryBle();
    }
    if (now - lastLcdMs >= LCD_AUTO_MS) {
        lastLcdMs = now;
        nextScreen();
    }
    }