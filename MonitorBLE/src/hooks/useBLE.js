import { useState, useMemo } from 'react';
import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

// UUIDs idênticos aos que configuramos no setup() do ESP32
const SERVICE_UUID = "4FAFC201-1FB5-459E-8FCC-C5C9C331914B";
const CHAR_TELEMETRY_UUID = "4FAFC202-1FB5-459E-8FCC-C5C9C331914B";
const CHAR_LEDS_UUID = "4FAFC203-1FB5-459E-8FCC-C5C9C331914B";
const CHAR_RGB_UUID = "4FAFC204-1FB5-459E-8FCC-C5C9C331914B";
const CHAR_COMMAND_UUID = "4FAFC205-1FB5-459E-8FCC-C5C9C331914B";

export function useBLE() {
    const bleManager = useMemo(() => new BleManager(), []);
    const [connectedDevice, setConnectedDevice] = useState(null);
    const [allDevices, setAllDevices] = useState([]);

    // Estados da Telemetria Atual e Extremos
    const [telemetry, setTelemetry] = useState({
        temp: 0, hum: 0, minTemp: 0, maxTemp: 0, minHum: 0, maxHum: 0
    });

    // Histórico para alimentar o Gráfico (guarda as últimas 6 leituras)
    const [tempHistory, setTempHistory] = useState([0, 0, 0, 0, 0, 0]);
    const [humHistory, setHumHistory] = useState([0, 0, 0, 0, 0, 0]);

    // Estado dos LEDs (vêm do ESP32)
    const [ledsState, setLedsState] = useState({ led1: false, led2: false });

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

    // Função auxiliar para converter Base64 vindo do BLE em um Array de Bytes
    const base64ToBytes = (base64) => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };

    // Função para ler 4 bytes seguidos e transformar de volta em um número Float
    const parseFloatFromBuffer = (buffer, byteOffset) => {
        const view = new DataView(buffer);
        return view.getFloat32(byteOffset, true); // true = Little Endian (padrão do ESP32)
    };

    // Iniciar a escuta ativa de dados por Notificação GATT
    const startStreamingData = (device) => {
        device.monitorCharacteristicForService(SERVICE_UUID, CHAR_TELEMETRY_UUID, (error, characteristic) => {
            if (error) {
                console.log("Erro no monitoramento de dados:", error);
                return;
            }
            if (characteristic?.value) {
                const buffer = base64ToBytes(characteristic.value);

                // Desempacota os 6 floats na ordem idêntica do firmware
                const t = parseFloatFromBuffer(buffer, 0);
                const h = parseFloatFromBuffer(buffer, 4);
                const mnT = parseFloatFromBuffer(buffer, 8);
                const mxT = parseFloatFromBuffer(buffer, 12);
                const mnH = parseFloatFromBuffer(buffer, 16);
                const mxH = parseFloatFromBuffer(buffer, 20);

                // Atualiza o painel instantâneo se os valores forem válidos
                if (!isNaN(t) && !isNaN(h)) {
                    setTelemetry({ temp: t, hum: h, minTemp: mnT, maxTemp: mxT, minHum: mnH, maxHum: mxH });

                    // Atualiza a fila do gráfico (remove o mais antigo, adiciona o novo no fim)
                    setTempHistory((prev) => [...prev.slice(1), t]);
                    setHumHistory((prev) => [...prev.slice(1), h]);
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

            // Inicia o fluxo de gráficos imediatamente após conectar
            startStreamingData(deviceConnection);
            return true;
        } catch (e) {
            console.log("Erro ao conectar:", e);
            return false;
        }
    };

    // --- FUNÇÕES DE ENVIO DE COMANDO (CELULAR -> ESP32) ---

    // Enviar comando para ligar/desligar LED1 e LED2
    const writeLeds = async (l1, l2) => {
        if (!connectedDevice) return;
        const payload = btoa(String.fromCharCode(l1 ? 1 : 0, l2 ? 1 : 0));
        try {
            await bleManager.writeCharacteristicWithResponseForDevice(
                connectedDevice.id, SERVICE_UUID, CHAR_LEDS_UUID, payload
            );
            setLedsState({ led1: l1, led2: l2 });
        } catch (e) {
            console.log("Erro ao gravar LEDs:", e);
        }
    };

    // Enviar cor selecionada para o LED RGB
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

    // Enviar comandos simples (1 = Reset Min/Max, 2 = Próxima Tela LCD)
    const sendCommand = async (cmdId) => {
        if (!connectedDevice) return;
        const payload = btoa(String.fromCharCode(cmdId));
        try {
            await bleManager.writeCharacteristicWithResponseForDevice(
                connectedDevice.id, SERVICE_UUID, CHAR_COMMAND_UUID, payload
            );
        } catch (e) {
            console.log("Erro ao enviar comando:", e);
        }
    };

    const disconnectDevice = async () => {
        if (connectedDevice) {
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
        sendCommand
    };
}