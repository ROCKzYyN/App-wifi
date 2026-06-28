import { useState, useMemo, useRef, useEffect } from 'react';


// Definições de UUIDs alinhadas com o edital
const SERVICE_MONITORING_UUID = "0000181a-0000-1000-8000-00805f9b34fb";
const CHAR_TELEMETRY_UUID     = "4fafc202-1fb5-459e-8fcc-c5c9c331914b";
const CHAR_HISTORY_UUID       = "4fafc206-1fb5-459e-8fcc-c5c9c331914b";
const SERVICE_ACTUATORS_UUID  = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHAR_LEDS_UUID          = "4fafc203-1fb5-459e-8fcc-c5c9c331914b";
const CHAR_RGB_UUID           = "4fafc204-1fb5-459e-8fcc-c5c9c331914b";
const CHAR_COMMAND_UUID       = "4fafc205-1fb5-459e-8fcc-c5c9c331914b";
const SERVICE_CONNECTION_UUID = "4fafc210-1fb5-459e-8fcc-c5c9c331914b";
const CHAR_RSSI_UUID          = "4fafc211-1fb5-459e-8fcc-c5c9c331914b";
const CHAR_NOTIF_COUNT_UUID   = "4fafc212-1fb5-459e-8fcc-c5c9c331914b";

export function useBLEMockado() {
    const [connectedDevice, setConnectedDevice] = useState(null);
    const [allDevices, setAllDevices] = useState([]);

    const [telemetry, setTelemetry] = useState({
        temp: 24.5,
        hum: 52.0,
        minTemp: 22.0,
        maxTemp: 27.5,
        minHum: 45.0,
        maxHum: 60.0
    });

    const [tempHistory, setTempHistory] = useState([24.0, 24.2, 24.5, 24.3, 24.6, 24.5]);
    const [humHistory, setHumHistory] = useState([50.0, 51.5, 52.0, 51.8, 52.5, 52.0]);
    const [ledsState, setLedsState] = useState({ led1: false, led2: false });

    // Novos estados para RSSI, PPM e Histórico de Hora em Hora
    const [rssi, setRssi] = useState(-65);
    const [rssiHistory, setRssiHistory] = useState([-60, -62, -65, -63, -67, -65]);
    const [packetsPerMinute, setPacketsPerMinute] = useState(0);

    // Histórico de hora em hora local
    const [hourlyTempHistory, setHourlyTempHistory] = useState([22.5, 23.0, 23.8, 24.5, 25.0, 24.5]);
    const [hourlyHumHistory, setHourlyHumHistory] = useState([48.0, 49.5, 51.0, 53.0, 52.5, 52.0]);
    const [hourlyLabels, setHourlyLabels] = useState(() => {
        // Inicializa com as últimas 6 horas
        const labels = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 60 * 60 * 1000);
            labels.push(`${d.getHours()}h`);
        }
        return labels;
    });

    // Refs para controle de timers internos
    const dataIntervalRef = useRef(null);
    const rssiIntervalRef = useRef(null);
    const ppmIntervalRef = useRef(null);
    const hourlyIntervalRef = useRef(null);
    const packetCounterRef = useRef(0);

    const requestPermissions = async () => {
        console.log('[MOCK-BLE] Permissões solicitadas e concedidas automaticamente.');
        return true;
    };

    const scanForDevices = () => {
        setAllDevices([]);
        console.log('[MOCK-BLE] Iniciando scan para dispositivos...');
        setTimeout(() => {
            setAllDevices([
                {
                    id: 'MOCK-ESP32-DEVICE',
                    name: 'ESP32_Monitor_BLE',
                    localName: 'ESP32_Monitor_BLE',
                    rssi: -60,
                }
            ]);
        }, 1000);
    };

    const connectToDevice = async (device) => {
        console.log('[MOCK-BLE] Conectando ao dispositivo:', device.name);
        try {
            // Simula um atraso na conexão
            await new Promise(resolve => setTimeout(resolve, 800));

            const mockConnection = {
                id: device.id,
                name: device.name,
                discoverAllServicesAndCharacteristics: async () => true,
            };

            setConnectedDevice(mockConnection);
            startSimulatedData();
            return true;
        } catch (e) {
            console.log('[MOCK-BLE] Erro ao conectar:', e);
            return false;
        }
    };

    const disconnectDevice = async () => {
        console.log('[MOCK-BLE] Desconectando...');
        stopSimulatedData();
        setConnectedDevice(null);
    };

    // Inicia geradores de dados mockados
    const startSimulatedData = () => {
        stopSimulatedData(); // Evita timers duplicados

        packetCounterRef.current = 0;
        setPacketsPerMinute(0);

        // 1. Simulação de Telemetria (Recebe a cada 2 segundos)
        dataIntervalRef.current = setInterval(() => {
            packetCounterRef.current += 1;

            setTelemetry(prev => {
                const diffT = (Math.random() - 0.5) * 0.4;
                const diffH = (Math.random() - 0.5) * 1.0;
                const newT = Math.max(15, Math.min(45, prev.temp + diffT));
                const newH = Math.max(20, Math.min(95, prev.hum + diffH));

                // Atualiza históricos rápidos de temp/hum
                setTempHistory(history => [...history.slice(1), newT]);
                setHumHistory(history => [...history.slice(1), newH]);

                return {
                    temp: newT,
                    hum: newH,
                    minTemp: Math.min(prev.minTemp, newT),
                    maxTemp: Math.max(prev.maxTemp, newT),
                    minHum: Math.min(prev.minHum, newH),
                    maxHum: Math.max(prev.maxHum, newH)
                };
            });
        }, 2000);

        // 2. Simulação de RSSI (Leitura a cada 3 segundos)
        rssiIntervalRef.current = setInterval(() => {
            setRssi(prev => {
                // Oscila RSSI entre -50 e -85
                const diff = Math.round((Math.random() - 0.5) * 8);
                const nextRssi = Math.max(-85, Math.min(-50, prev + diff));
                setRssiHistory(history => [...history.slice(1), nextRssi]);
                
                // Simula o envio de RSSI de volta para o ESP32 mockado
                console.log(`[MOCK-ESP32] RSSI enviado de volta: ${nextRssi} dBm`);
                
                return nextRssi;
            });
        }, 3000);

        // 3. Contador de Pacotes por Minuto (Roda a cada 60 segundos)
        ppmIntervalRef.current = setInterval(() => {
            setPacketsPerMinute(packetCounterRef.current);
            console.log(`[MOCK-BLE] Pacotes recebidos no último minuto: ${packetCounterRef.current}`);
            packetCounterRef.current = 0;
        }, 60000);

        // 4. Simulador do Histórico de Hora em Hora (Gera novo ponto a cada 1 hora real)
        hourlyIntervalRef.current = setInterval(() => {
            const now = new Date();
            const hourLabel = `${now.getHours()}h`;

            setHourlyLabels(labels => [...labels.slice(1), hourLabel]);

            // Pega os valores de telemetria atuais e joga no histórico
            setTelemetry(current => {
                setHourlyTempHistory(hist => [...hist.slice(1), current.temp]);
                setHourlyHumHistory(hist => [...hist.slice(1), current.hum]);
                return current;
            });
        }, 60 * 60 * 1000); // 1 hora
    };

    const stopSimulatedData = () => {
        if (dataIntervalRef.current) clearInterval(dataIntervalRef.current);
        if (rssiIntervalRef.current) clearInterval(rssiIntervalRef.current);
        if (ppmIntervalRef.current) clearInterval(ppmIntervalRef.current);
        if (hourlyIntervalRef.current) clearInterval(hourlyIntervalRef.current);
    };

    // Limpa os timers se o hook for desmontado
    useEffect(() => {
        return () => stopSimulatedData();
    }, []);

    const writeLeds = async (l1, l2) => {
        if (!connectedDevice) return;
        console.log(`[MOCK-BLE] Escrevendo LEDs: led1=${l1}, led2=${l2}`);
        setLedsState({ led1: l1, led2: l2 });
    };

    const writeRgb = async (r, g, b) => {
        if (!connectedDevice) return;
        console.log(`[MOCK-BLE] Escrevendo cores RGB: R=${r}, G=${g}, B=${b}`);
    };

    const sendCommand = async (cmdId) => {
        if (!connectedDevice) return;
        console.log(`[MOCK-BLE] Enviando comando customizado: ${cmdId}`);
        if (cmdId === 1) {
            // Resetar Min/Max
            setTelemetry(prev => ({
                ...prev,
                minTemp: prev.temp,
                maxTemp: prev.temp,
                minHum: prev.hum,
                maxHum: prev.hum
            }));
            console.log('[MOCK-BLE] Valores Mín/Máx resetados.');
        }
    };

    return {
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
        // Novos retornos
        rssi,
        rssiHistory,
        packetsPerMinute,
        hourlyTempHistory,
        hourlyHumHistory,
        hourlyLabels
    };
}
