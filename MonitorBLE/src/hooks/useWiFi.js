import { useState, useRef, useEffect } from 'react';
import { Client, Message } from 'paho-mqtt';

export function useWiFi() {
    const [connectedDevice, setConnectedDevice] = useState(null);
    const [allDevices, setAllDevices] = useState([
        { id: 'uffs/gex1087/monitor_wifi_dupla', name: 'ESP32 Wi-Fi (Padrão)' },
        { id: 'uffs/gex1087/monitor_wifi_grupo1', name: 'ESP32 Wi-Fi (Grupo 1)' },
    ]);

    const [telemetry, setTelemetry] = useState({
        temp: 0, hum: 0, minTemp: 0, maxTemp: 0, minHum: 0, maxHum: 0
    });

    const [tempHistory, setTempHistory] = useState([0, 0, 0, 0, 0, 0]);
    const [humHistory, setHumHistory] = useState([0, 0, 0, 0, 0, 0]);
    const [ledsState, setLedsState] = useState({ led1: false, led2: false });

    // Estados para RSSI, PPM e Histórico de Hora em Hora
    const [rssi, setRssi] = useState(-100);
    const [rssiHistory, setRssiHistory] = useState([-100, -100, -100, -100, -100, -100]);
    const [packetsPerMinute, setPacketsPerMinute] = useState(0);

    const [hourlyTempHistory, setHourlyTempHistory] = useState([0, 0, 0, 0, 0, 0]);
    const [hourlyHumHistory, setHourlyHumHistory] = useState([0, 0, 0, 0, 0, 0]);
    const [hourlyLabels, setHourlyLabels] = useState(() => {
        const labels = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 60 * 60 * 1000);
            labels.push(`${d.getHours()}h`);
        }
        return labels;
    });

    const mqttClientRef = useRef(null);
    const packetCounterRef = useRef(0);
    const ppmIntervalRef = useRef(null);
    const prefixRef = useRef('');

    const requestPermissions = async () => {
        // Wi-Fi / MQTT não exige permissões especiais de hardware (Bluetooth/Localização)
        return true;
    };

    const scanForDevices = () => {
        // Simula a descoberta de "dispositivos" listando as opções de canais/tópicos MQTT padrão
        setAllDevices([
            { id: 'uffs/gex1087/monitor_wifi_dupla', name: 'ESP32 Wi-Fi (Padrão)' },
            { id: 'uffs/gex1087/monitor_wifi_grupo1', name: 'ESP32 Wi-Fi (Grupo 1)' },
            { id: 'uffs/gex1087/monitor_wifi_lucas_wictor', name: 'ESP32 Wi-Fi (Lucas & Wictor)' },
        ]);
    };

    const connectToDevice = async (device) => {
        const prefix = device.id;
        prefixRef.current = prefix;
        console.log('[WiFi hook] Conectando ao broker para o prefixo:', prefix);

        return new Promise((resolve) => {
            try {
                // Instancia o Eclipse Paho MQTT client apontando para wss://broker.hivemq.com:8884/mqtt
                const clientId = 'expo_wifi_client_' + Math.random().toString(16).substring(2, 10);
                const client = new Client('broker.hivemq.com', 8884, '/mqtt', clientId);
                mqttClientRef.current = client;

                client.onConnectionLost = (responseObject) => {
                    if (responseObject.errorCode !== 0) {
                        console.log('[WiFi hook] Conexão com o broker perdida:', responseObject.errorMessage);
                    }
                    setConnectedDevice(null);
                    stopMonitoring();
                };

                client.onMessageArrived = (message) => {
                    const topic = message.destinationName;
                    const payload = message.payloadString;
                    packetCounterRef.current += 1;

                    // Extrai o subtópico removendo o prefixo base
                    const basePrefix = prefix.endsWith('/') ? prefix : prefix + '/';
                    if (!topic.startsWith(basePrefix)) return;
                    const subTopic = topic.substring(basePrefix.length);

                    handleIncomingMessage(subTopic, payload);
                };

                client.connect({
                    useSSL: true,
                    timeout: 5,
                    keepAliveInterval: 20,
                    cleanSession: true,
                    onSuccess: () => {
                        console.log('[WiFi hook] Conectado ao Broker MQTT via WebSockets!');
                        setConnectedDevice({ id: prefix, name: device.name });
                        
                        // Subscreve nos tópicos de telemetria do ESP32
                        const basePrefix = prefix.endsWith('/') ? prefix : prefix + '/';
                        client.subscribe(basePrefix + '#');

                        // Solicita o histórico acumulado imediatamente
                        try {
                            const reqMessage = new Message('get');
                            reqMessage.destinationName = basePrefix + 'historico/requisicao';
                            client.send(reqMessage);
                        } catch (e) {
                            console.log('[WiFi hook] Erro ao requisitar histórico:', e.message);
                        }

                        startMonitoring();
                        resolve(true);
                    },
                    onFailure: (err) => {
                        console.log('[WiFi hook] Falha ao conectar ao Broker:', err);
                        setConnectedDevice(null);
                        resolve(false);
                    }
                });
            } catch (err) {
                console.log('[WiFi hook] Erro na inicialização do MQTT:', err);
                setConnectedDevice(null);
                resolve(false);
            }
        });
    };

    const disconnectDevice = async () => {
        console.log('[WiFi hook] Desconectando...');
        if (mqttClientRef.current) {
            try {
                mqttClientRef.current.disconnect();
            } catch (e) {}
            mqttClientRef.current = null;
        }
        setConnectedDevice(null);
        stopMonitoring();
    };

    const handleIncomingMessage = (subTopic, payload) => {
        // 1. Leituras de Temperatura e Mínimos/Máximos
        if (subTopic === 'temperatura/celsius') {
            const val = parseFloat(payload);
            if (!isNaN(val)) {
                setTelemetry(prev => ({ ...prev, temp: val }));
                setTempHistory(history => [...history.slice(1), val]);
            }
        }
        else if (subTopic === 'temperatura/min') {
            const val = parseFloat(payload);
            if (!isNaN(val)) {
                setTelemetry(prev => ({ ...prev, minTemp: val }));
            }
        }
        else if (subTopic === 'temperatura/max') {
            const val = parseFloat(payload);
            if (!isNaN(val)) {
                setTelemetry(prev => ({ ...prev, maxTemp: val }));
            }
        }
        // 2. Leituras de Umidade e Mínimos/Máximos
        else if (subTopic === 'umidade') {
            const val = parseFloat(payload);
            if (!isNaN(val)) {
                setTelemetry(prev => ({ ...prev, hum: val }));
                setHumHistory(history => [...history.slice(1), val]);
            }
        }
        else if (subTopic === 'umidade/min') {
            const val = parseFloat(payload);
            if (!isNaN(val)) {
                setTelemetry(prev => ({ ...prev, minHum: val }));
            }
        }
        else if (subTopic === 'umidade/max') {
            const val = parseFloat(payload);
            if (!isNaN(val)) {
                setTelemetry(prev => ({ ...prev, maxHum: val }));
            }
        }
        // 3. Força do sinal (RSSI)
        else if (subTopic === 'rssi') {
            const val = parseInt(payload);
            if (!isNaN(val)) {
                setRssi(val);
                setRssiHistory(history => [...history.slice(1), val]);
            }
        }
        // 4. Estados dos LEDs simples
        else if (subTopic === 'leds/estado') {
            try {
                const data = JSON.parse(payload);
                if (data.hasOwnProperty('led1') && data.hasOwnProperty('led2')) {
                    setLedsState({ led1: data.led1, led2: data.led2 });
                }
            } catch (e) {
                console.log('[WiFi hook] Erro ao parsear leds/estado:', e.message);
            }
        }
        // 5. Histórico em lote de 60 minutos
        else if (subTopic === 'historico') {
            try {
                const data = JSON.parse(payload);
                if (data.hasOwnProperty('temp') && data.hasOwnProperty('hum')) {
                    // Pega as últimas 6 médias de 1 minuto para preencher os 6 blocos do gráfico
                    const last6Temps = data.temp.slice(-6);
                    const last6Hums = data.hum.slice(-6);
                    
                    const paddedTemps = Array(6).fill(0);
                    const paddedHums = Array(6).fill(0);
                    
                    for (let i = 0; i < last6Temps.length; i++) {
                        paddedTemps[6 - last6Temps.length + i] = last6Temps[i];
                    }
                    for (let i = 0; i < last6Hums.length; i++) {
                        paddedHums[6 - last6Hums.length + i] = last6Hums[i];
                    }

                    setHourlyTempHistory(paddedTemps);
                    setHourlyHumHistory(paddedHums);
                }
            } catch (e) {
                console.log('[WiFi hook] Erro ao parsear historico JSON:', e.message);
            }
        }
    };

    const writeLeds = async (l1, l2) => {
        if (!mqttClientRef.current || !connectedDevice) return;
        
        try {
            const basePrefix = prefixRef.current.endsWith('/') ? prefixRef.current : prefixRef.current + '/';
            const topic = basePrefix + 'leds/comando';
            const payload = JSON.stringify({ led1: l1, led2: l2 });
            
            const message = new Message(payload);
            message.destinationName = topic;
            mqttClientRef.current.send(message);
            console.log('[WiFi hook] Enviado comando de LED:', payload);
        } catch (e) {
            console.log('[WiFi hook] Erro ao enviar comando de LED:', e.message);
        }
    };

    const writeRgb = async (r, g, b) => {
        if (!mqttClientRef.current || !connectedDevice) return;

        try {
            const basePrefix = prefixRef.current.endsWith('/') ? prefixRef.current : prefixRef.current + '/';
            const topic = basePrefix + 'rgb/comando';
            const payload = `${r},${g},${b}`;
            
            const message = new Message(payload);
            message.destinationName = topic;
            mqttClientRef.current.send(message);
            console.log('[WiFi hook] Enviado comando RGB:', payload);
        } catch (e) {
            console.log('[WiFi hook] Erro ao enviar comando RGB:', e.message);
        }
    };

    const sendCommand = async (cmdId) => {
        if (!mqttClientRef.current || !connectedDevice) return;

        try {
            const basePrefix = prefixRef.current.endsWith('/') ? prefixRef.current : prefixRef.current + '/';
            let topic, payload;

            if (cmdId === 1) {
                // Comando 1: Resetar Mín/Máx
                topic = basePrefix + 'controle/reset';
                payload = 'reset';
            } else if (cmdId === 2) {
                // Comando 2: Próxima tela no LCD físico (não aplicável via MQTT direto no edital, mas enviado para manter suporte à interface)
                topic = basePrefix + 'controle/lcd';
                payload = 'next';
            }

            if (topic) {
                const message = new Message(payload);
                message.destinationName = topic;
                mqttClientRef.current.send(message);
                console.log(`[WiFi hook] Enviado comando ${cmdId}:`, payload);
            }
        } catch (e) {
            console.log('[WiFi hook] Erro ao enviar comando global:', e.message);
        }
    };

    const startMonitoring = () => {
        stopMonitoring();
        packetCounterRef.current = 0;
        setPacketsPerMinute(0);

        // Atualiza a taxa de pacotes por minuto (PPM) a cada 60s
        ppmIntervalRef.current = setInterval(() => {
            setPacketsPerMinute(packetCounterRef.current);
            packetCounterRef.current = 0;
        }, 60000);
    };

    const stopMonitoring = () => {
        if (ppmIntervalRef.current) {
            clearInterval(ppmIntervalRef.current);
            ppmIntervalRef.current = null;
        }
    };

    useEffect(() => {
        return () => stopMonitoring();
    }, []);

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
        rssi,
        rssiHistory,
        packetsPerMinute,
        hourlyTempHistory,
        hourlyHumHistory,
        hourlyLabels
    };
}
