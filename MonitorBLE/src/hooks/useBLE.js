import { useState, useMemo, useRef, useEffect } from 'react';
import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

const SERVICE_UUID = "4FAFC201-1FB5-459E-8FCC-C5C9C331914B";
const CHAR_TELEMETRY_UUID = "4FAFC202-1FB5-459E-8FCC-C5C9C331914B";
const CHAR_LEDS_UUID = "4FAFC203-1FB5-459E-8FCC-C5C9C331914B";
const CHAR_RGB_UUID = "4FAFC204-1FB5-459E-8FCC-C5C9C331914B";
const CHAR_COMMAND_UUID = "4FAFC205-1FB5-459E-8FCC-C5C9C331914B";

export function useBLE() {
    const bleManager = useMemo(() => new BleManager(), []);
    const [connectedDevice, setConnectedDevice] = useState(null);
    const [allDevices, setAllDevices] = useState([]);

    const [telemetry, setTelemetry] = useState({
        temp: 0, hum: 0, minTemp: 0, maxTemp: 0, minHum: 0, maxHum: 0
    });

    const [tempHistory, setTempHistory] = useState([0, 0, 0, 0, 0, 0]);
    const [humHistory, setHumHistory] = useState([0, 0, 0, 0, 0, 0]);
    const [ledsState, setLedsState] = useState({ led1: false, led2: false });

    // Novos estados de RSSI, PPM e Histórico de Hora em Hora
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

    // Refs para gerenciamento de timers
    const rssiIntervalRef = useRef(null);
    const ppmIntervalRef = useRef(null);
    const hourlyIntervalRef = useRef(null);
    const packetCounterRef = useRef(0);

    const startRealTimeMonitoring = (device) => {
        stopRealTimeMonitoring();

        packetCounterRef.current = 0;
        setPacketsPerMinute(0);

        // 1. Atualizar RSSI a cada 3 segundos
        rssiIntervalRef.current = setInterval(async () => {
            try {
                const deviceWithRssi = await device.readRSSI();
                if (deviceWithRssi.rssi) {
                    setRssi(deviceWithRssi.rssi);
                    setRssiHistory(prev => [...prev.slice(1), deviceWithRssi.rssi]);
                }
            } catch (err) {
                console.log("[BLE] Erro ao ler RSSI:", err.message || err);
            }
        }, 3000);

        // 2. Contador de pacotes por minuto (PPM) a cada 60 segundos
        ppmIntervalRef.current = setInterval(() => {
            setPacketsPerMinute(packetCounterRef.current);
            console.log(`[BLE] Pacotes recebidos no último minuto: ${packetCounterRef.current}`);
            packetCounterRef.current = 0;
        }, 60000);

        // 3. Atualizar histórico local de hora em hora
        hourlyIntervalRef.current = setInterval(() => {
            const now = new Date();
            const hourLabel = `${now.getHours()}h`;

            setHourlyLabels(labels => [...labels.slice(1), hourLabel]);
            setTelemetry(current => {
                setHourlyTempHistory(hist => [...hist.slice(1), current.temp]);
                setHourlyHumHistory(hist => [...hist.slice(1), current.hum]);
                return current;
            });
        }, 60 * 60 * 1000);
    };

    const stopRealTimeMonitoring = () => {
        if (rssiIntervalRef.current) clearInterval(rssiIntervalRef.current);
        if (ppmIntervalRef.current) clearInterval(ppmIntervalRef.current);
        if (hourlyIntervalRef.current) clearInterval(hourlyIntervalRef.current);
    };

    useEffect(() => {
        return () => stopRealTimeMonitoring();
    }, []);

    const requestPermissions = async () => {
        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]);
            return (
                granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
                granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
            );
        }
        return true;
    };

    const scanForDevices = () => {
        setAllDevices([]);
        bleManager.startDeviceScan(null, null, (error, device) => {
            if (error) {
                console.log("Erro no scanner:", error);
                return;
            }
            if (device.name === 'ESP32_Monitor_BLE' || device.localName === 'ESP32_Monitor_BLE') {
                setAllDevices((prev) => {
                    if (!prev.some((d) => d.id === device.id)) return [...prev, device];
                    return prev;
                });
            }
        });
    };

    const base64ToBytes = (base64) => {
        if (!base64) return new ArrayBuffer(0);
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        } catch (e) {
            console.log("Erro conversao base64:", e);
            return new ArrayBuffer(0);
        }
    };

    const parseFloatFromBuffer = (buffer, byteOffset) => {
        if (!buffer || buffer.byteLength < byteOffset + 4) {
            throw new Error(`Buffer muito pequeno para ler offset ${byteOffset}`);
        }
        const view = new DataView(buffer);
        return view.getFloat32(byteOffset, true);
    };

    const startStreamingData = (device) => {
        let firstPacket = true;
        device.monitorCharacteristicForService(SERVICE_UUID, CHAR_TELEMETRY_UUID, (error, characteristic) => {
            if (error) {
                console.log("Erro no monitoramento de dados:", error);
                return;
            }
            if (characteristic?.value) {
                const buffer = base64ToBytes(characteristic.value);
                packetCounterRef.current += 1;

                // Loga o tamanho do primeiro pacote para diagnóstico
                if (firstPacket) {
                    console.log(`[BLE] Primeiro pacote recebido: ${buffer.byteLength} bytes`);
                    firstPacket = false;
                }

                // Requer pelo menos temp + hum (8 bytes) para processar
                if (buffer.byteLength < 8) {
                    console.log(`[BLE] Pacote muito pequeno (${buffer.byteLength} bytes), ignorando.`);
                    return;
                }

                try {
                    // Leitura adaptativa: só lê os campos que o buffer comporta
                    const t    = parseFloatFromBuffer(buffer, 0);
                    const h    = parseFloatFromBuffer(buffer, 4);
                    const mnT  = buffer.byteLength >= 12 ? parseFloatFromBuffer(buffer, 8)  : 0;
                    const mxT  = buffer.byteLength >= 16 ? parseFloatFromBuffer(buffer, 12) : 0;
                    const mnH  = buffer.byteLength >= 20 ? parseFloatFromBuffer(buffer, 16) : 0;
                    const mxH  = buffer.byteLength >= 24 ? parseFloatFromBuffer(buffer, 20) : mnH;

                    if (!isNaN(t) && !isNaN(h)) {
                        setTelemetry({ temp: t, hum: h, minTemp: mnT, maxTemp: mxT, minHum: mnH, maxHum: mxH });
                        setTempHistory((prev) => [...prev.slice(1), t]);
                        setHumHistory((prev) => [...prev.slice(1), h]);
                    }
                } catch (errorLeitura) {
                    console.log("[BLE] Erro ao ler pacote:", errorLeitura.message);
                }
            }
        });
    };

    const connectToDevice = async (device) => {
        try {
            bleManager.stopDeviceScan();
            const deviceConnection = await bleManager.connectToDevice(device.id);
            setConnectedDevice(deviceConnection);
            await deviceConnection.discoverAllServicesAndCharacteristics();

            startStreamingData(deviceConnection);
            startRealTimeMonitoring(deviceConnection);
            return true;
        } catch (e) {
            console.log("Erro ao conectar:", e);
            return false;
        }
    };

    const writeLeds = async (l1, l2) => {
        if (!connectedDevice) {
            console.log('[LED] writeLeds chamado mas connectedDevice é null!');
            return;
        }
        console.log(`[LED] Enviando: led1=${l1}, led2=${l2} para device ${connectedDevice.id}`);
        const payload = btoa(String.fromCharCode(l1 ? 1 : 0, l2 ? 1 : 0));
        // Salva estado anterior para poder reverter em caso de falha
        const prev = ledsState;
        setLedsState({ led1: l1, led2: l2 });
        try {
            // Chamada direta no objeto do dispositivo (evita fila do bleManager)
            await connectedDevice.writeCharacteristicWithResponseForService(
                SERVICE_UUID, CHAR_LEDS_UUID, payload
            );
            console.log('[LED] Escrita bem-sucedida!');
        } catch (e) {
            console.log('[LED] Erro ao gravar LEDs:', e.message || e);
            setLedsState(prev); // Reverte para o estado anterior correto
        }
    };

    const writeRgb = async (r, g, b) => {
        if (!connectedDevice) return;
        const payload = btoa(String.fromCharCode(r, g, b));
        try {
            await bleManager.writeCharacteristicWithoutResponseForDevice(
                connectedDevice.id, SERVICE_UUID, CHAR_RGB_UUID, payload
            );
        } catch (e) {
            console.log("Erro ao gravar RGB:", e);
        }
    };

    const sendCommand = async (cmdId) => {
        if (!connectedDevice) return;
        const payload = btoa(String.fromCharCode(cmdId));
        try {
            // Usa writeWithoutResponse para evitar timeout de ACK.
            // Se o firmware do ESP32 exigir ACK, troque por writeCharacteristicWithResponseForDevice.
            await bleManager.writeCharacteristicWithoutResponseForDevice(
                connectedDevice.id, SERVICE_UUID, CHAR_COMMAND_UUID, payload
            );
        } catch (e) {
            console.log("Erro ao enviar comando:", e);
        }
    };

    const disconnectDevice = async () => {
        if (connectedDevice) {
            stopRealTimeMonitoring();
            await bleManager.cancelDeviceConnection(connectedDevice.id);
            setConnectedDevice(null);
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
        // Novos retornos para equiparar com o mock
        rssi,
        rssiHistory,
        packetsPerMinute,
        hourlyTempHistory,
        hourlyHumHistory,
        hourlyLabels
    };
}