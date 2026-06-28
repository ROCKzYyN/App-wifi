// Elementos do DOM
const inputBroker = document.getElementById('mqtt-broker');
const inputPrefix = document.getElementById('mqtt-prefix');
const btnConnect = document.getElementById('btn-connect');
const brokerStatusPill = document.getElementById('broker-status-pill');
const brokerStatusText = document.getElementById('broker-status-text');

const deviceStatusCircle = document.getElementById('device-status-circle');
const deviceStatusText = document.getElementById('device-status-text');
const rssiVal = document.getElementById('rssi-val');
const updateRateDisplay = document.getElementById('update-rate');

const tempCDisplay = document.getElementById('temp-c');
const tempFDisplay = document.getElementById('temp-f');
const humidityDisplay = document.getElementById('humidity');
const humidityBar = document.getElementById('humidity-bar');

const led1Switch = document.getElementById('led1-switch');
const led2Switch = document.getElementById('led2-switch');
const btnResetMinMax = document.getElementById('btn-reset-minmax');
const localLockAlert = document.getElementById('local-lock-alert');

const rgbR = document.getElementById('rgb-r');
const rgbG = document.getElementById('rgb-g');
const rgbB = document.getElementById('rgb-b');
const rgbRVal = document.getElementById('rgb-r-val');
const rgbGVal = document.getElementById('rgb-g-val');
const rgbBVal = document.getElementById('rgb-b-val');
const rgbPreview = document.getElementById('rgb-preview');

const currentChartUnitText = document.getElementById('current-chart-unit');

// Variáveis de Estado
let mqttClient = null;
let isConnected = false;
let messageCount = 0;
let currentUnit = 'C'; // 'C' ou 'F' (definido pelo Switch 4 do ESP32)
let isLocalLocked = false;
let deviceOnline = false;

// Histórico de mensagens recebidas no último minuto
let messageTimestamps = [];

// Dados temporários para o gráfico histórico
let rawHistoryTempC = [];
let rawHistoryHum = [];

// Inicialização dos Gráficos com Chart.js
let historyChart = null;
let rssiChart = null;

function initCharts() {
    // 1. Gráfico Histórico (Temperatura e Umidade)
    const ctxHistory = document.getElementById('historyChart').getContext('2d');
    historyChart = new Chart(ctxHistory, {
        type: 'line',
        data: {
            labels: Array.from({length: 60}, (_, i) => `${60 - i}m`),
            datasets: [
                {
                    label: 'Temperatura',
                    data: Array(60).fill(null),
                    borderColor: '#ff5c5c',
                    backgroundColor: 'rgba(255, 92, 92, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y-temp',
                    spanGaps: true
                },
                {
                    label: 'Umidade (%)',
                    data: Array(60).fill(null),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y-hum',
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#f3f4f6' }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af' }
                },
                'y-temp': {
                    type: 'linear',
                    position: 'left',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#ff5c5c' },
                    title: {
                        display: true,
                        text: 'Temperatura (°C)',
                        color: '#ff5c5c'
                    }
                },
                'y-hum': {
                    type: 'linear',
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#3b82f6' },
                    title: {
                        display: true,
                        text: 'Umidade (%)',
                        color: '#3b82f6'
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });

    // 2. Gráfico de RSSI (Últimos 60s)
    const ctxRssi = document.getElementById('rssiChart').getContext('2d');
    rssiChart = new Chart(ctxRssi, {
        type: 'line',
        data: {
            labels: Array(30).fill(''),
            datasets: [{
                label: 'Sinal RSSI (dBm)',
                data: Array(30).fill(null),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { display: false },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af' },
                    min: -100,
                    max: -30
                }
            }
        }
    });
}

// Inicia os gráficos
initCharts();

// Gerenciamento da taxa de telemetria
setInterval(() => {
    const now = Date.now();
    messageTimestamps = messageTimestamps.filter(t => now - t < 60000);
    updateRateDisplay.textContent = messageTimestamps.length;
}, 1000);

// Conectar / Desconectar do Broker
btnConnect.addEventListener('click', () => {
    if (isConnected) {
        disconnectMqtt();
    } else {
        connectMqtt();
    }
});

function connectMqtt() {
    const brokerUrl = inputBroker.value;
    const prefix = inputPrefix.value;

    if (!brokerUrl || !prefix) {
        alert('Por favor, preencha o Broker WebSocket e o Prefixo dos Tópicos.');
        return;
    }

    btnConnect.disabled = true;
    btnConnect.innerHTML = '<i data-lucide="loader" class="animate-spin"></i> Conectando...';
    lucide.createIcons();

    brokerStatusPill.className = 'connection-status-pill connecting';
    brokerStatusText.textContent = 'Conectando ao Broker...';

    // Cria um ID exclusivo de cliente
    const clientId = 'web_client_' + Math.random().toString(16).substr(2, 8);

    try {
        mqttClient = mqtt.connect(brokerUrl, {
            clientId: clientId,
            clean: true,
            connectTimeout: 5000,
            reconnectPeriod: 5000
        });

        mqttClient.on('connect', () => {
            isConnected = true;
            btnConnect.disabled = false;
            btnConnect.className = 'btn btn-secondary';
            btnConnect.innerHTML = '<i data-lucide="power"></i> Desconectar';
            brokerStatusPill.className = 'connection-status-pill online';
            brokerStatusText.textContent = 'Broker Conectado';
            lucide.createIcons();

            // Subscreve nos tópicos de telemetria e estado
            const subPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
            mqttClient.subscribe(subPrefix + '#');
            console.log('Subscrito em todos os tópicos sob o prefixo:', subPrefix);

            // Requisita o histórico acumulado no ESP32 imediatamente
            mqttClient.publish(subPrefix + 'historico/requisicao', 'get');
        });

        mqttClient.on('message', (topic, message) => {
            const topicStr = topic.toString();
            const messageStr = message.toString();
            const prefixVal = prefix.endsWith('/') ? prefix : prefix + '/';
            const subTopic = topicStr.substring(prefixVal.length);

            // Adiciona timestamp para cálculo do ritmo de telemetria
            messageTimestamps.push(Date.now());

            handleIncomingMqttMessage(subTopic, messageStr);
        });

        mqttClient.on('close', () => {
            console.log('Conexão fechada com o broker.');
            if (isConnected) {
                disconnectMqtt();
            }
        });

        mqttClient.on('error', (err) => {
            console.error('Erro de conexão MQTT:', err);
            disconnectMqtt();
            alert('Erro de conexão: Verifique se a URL do broker suporta WebSockets e se a porta está correta.');
        });

    } catch (e) {
        console.error(e);
        disconnectMqtt();
    }
}

function disconnectMqtt() {
    if (mqttClient) {
        mqttClient.end();
        mqttClient = null;
    }
    
    isConnected = false;
    deviceOnline = false;
    isLocalLocked = false;
    
    btnConnect.disabled = false;
    btnConnect.className = 'btn btn-primary';
    btnConnect.innerHTML = '<i data-lucide="power"></i> Conectar';
    
    brokerStatusPill.className = 'connection-status-pill offline';
    brokerStatusText.textContent = 'Broker Desconectado';
    
    setDeviceOfflineUI();
    lucide.createIcons();
}

function handleIncomingMqttMessage(subTopic, messageStr) {
    // 1. Status Geral LWT
    if (subTopic === 'status') {
        if (messageStr === 'online') {
            setDeviceOnlineUI();
        } else {
            setDeviceOfflineUI();
        }
    }

    // Se o dispositivo estiver offline, não processamos telemetrias
    if (subTopic !== 'status' && !deviceOnline) {
        setDeviceOnlineUI(); // Garante reativação caso receba telemetria direta
    }

    // 2. Leituras de Sensores
    if (subTopic === 'temperatura/celsius') {
        const val = parseFloat(messageStr);
        if (!isNaN(val)) {
            tempCDisplay.textContent = val.toFixed(1);
        }
    }
    else if (subTopic === 'temperatura/fahrenheit') {
        const val = parseFloat(messageStr);
        if (!isNaN(val)) {
            tempFDisplay.textContent = val.toFixed(1);
        }
    }
    else if (subTopic === 'umidade') {
        const val = parseFloat(messageStr);
        if (!isNaN(val)) {
            humidityDisplay.textContent = val.toFixed(1);
            humidityBar.style.width = `${Math.min(100, Math.max(0, val))}%`;
        }
    }
    // 3. Força do sinal RSSI
    else if (subTopic === 'rssi') {
        const val = parseInt(messageStr);
        if (!isNaN(val)) {
            rssiVal.textContent = `${val} dBm`;
            updateRssiChart(val);
        }
    }
    // 4. Estados dos Atuadores
    else if (subTopic === 'leds/estado') {
        try {
            const data = JSON.parse(messageStr);
            if (data.hasOwnProperty('led1')) {
                led1Switch.checked = data.led1;
            }
            if (data.hasOwnProperty('led2')) {
                led2Switch.checked = data.led2;
            }
        } catch (e) {
            console.error('Erro ao ler estado dos leds:', e);
        }
    }
    // 5. Bloqueio Local vs Remoto
    else if (subTopic === 'controle/bloqueio') {
        isLocalLocked = (messageStr === 'local');
        updateControlEnableState();
    }
    // 6. Unidade de exibição dos gráficos
    else if (subTopic === 'controle/unidade') {
        currentUnit = messageStr;
        currentChartUnitText.textContent = currentUnit === 'C' ? 'Celsius (°C)' : 'Fahrenheit (°F)';
        
        // Atualiza legenda e título do eixo Y do gráfico
        historyChart.options.scales['y-temp'].title.text = `Temperatura (°${currentUnit})`;
        updateHistoryChartUI();
    }
    // 7. Vetor de Histórico dos últimos 60 min
    else if (subTopic === 'historico') {
        try {
            const data = JSON.parse(messageStr);
            if (data.hasOwnProperty('temp') && data.hasOwnProperty('hum')) {
                rawHistoryTempC = data.temp;
                rawHistoryHum = data.hum;
                updateHistoryChartUI();
            }
        } catch (e) {
            console.error('Erro ao analisar histórico JSON:', e);
        }
    }
}

// Atualiza UI para modo Online
function setDeviceOnlineUI() {
    deviceOnline = true;
    deviceStatusCircle.className = 'status-circle online';
    deviceStatusText.textContent = 'ONLINE';
    updateControlEnableState();
}

// Atualiza UI para modo Offline
function setDeviceOfflineUI() {
    deviceOnline = false;
    deviceStatusCircle.className = 'status-circle offline';
    deviceStatusText.textContent = 'OFFLINE';
    rssiVal.textContent = '-- dBm';
    
    // Desabilita todos os botões e switches
    led1Switch.disabled = true;
    led2Switch.disabled = true;
    btnResetMinMax.disabled = true;
    
    rgbR.disabled = true;
    rgbG.disabled = true;
    rgbB.disabled = true;

    localLockAlert.style.display = 'none';
}

// Habilita/Desabilita os controles baseado nos estados de Conexão e Bloqueio físico
function updateControlEnableState() {
    if (!deviceOnline) {
        setDeviceOfflineUI();
        return;
    }

    if (isLocalLocked) {
        // Bloqueio físico ativo: Desativa os botões no dashboard
        led1Switch.disabled = true;
        led2Switch.disabled = true;
        rgbR.disabled = true;
        rgbG.disabled = true;
        rgbB.disabled = true;
        btnResetMinMax.disabled = false; // Reset de min/max local é permitido por comando
        localLockAlert.style.display = 'flex';
    } else {
        // Remoto liberado
        led1Switch.disabled = false;
        led2Switch.disabled = false;
        rgbR.disabled = false;
        rgbG.disabled = false;
        rgbB.disabled = false;
        btnResetMinMax.disabled = false;
        localLockAlert.style.display = 'none';
    }
}

// Atualiza o gráfico de RSSI (rolling chart)
function updateRssiChart(rssi) {
    const chartData = rssiChart.data.datasets[0].data;
    chartData.shift();
    chartData.push(rssi);
    rssiChart.update('none'); // Update sem animação lenta para tempo real suave
}

// Atualiza a visualização do gráfico histórico com base na unidade ativa (°C ou °F)
function updateHistoryChartUI() {
    if (!historyChart) return;

    // Atualiza dados de umidade
    // Se o vetor tiver menos que 60 valores, preenche o início com nulls
    const humData = Array(60).fill(null);
    for (let i = 0; i < rawHistoryHum.length; i++) {
        humData[60 - rawHistoryHum.length + i] = rawHistoryHum[i];
    }
    historyChart.data.datasets[1].data = humData;

    // Atualiza dados de temperatura (com conversão se estiver em Fahrenheit)
    const tempData = Array(60).fill(null);
    for (let i = 0; i < rawHistoryTempC.length; i++) {
        let tempVal = rawHistoryTempC[i];
        if (currentUnit === 'F') {
            tempVal = tempVal * 9.0 / 5.0 + 32.0; // Converte Celsius para Fahrenheit
        }
        tempData[60 - rawHistoryTempC.length + i] = tempVal;
    }
    historyChart.data.datasets[0].data = tempData;

    historyChart.update();
}

// Interações do Painel (Dashboard -> ESP32)

// Controle do LED 1
led1Switch.addEventListener('change', () => {
    if (!isConnected || !mqttClient) return;
    const prefix = inputPrefix.value;
    const topic = (prefix.endsWith('/') ? prefix : prefix + '/') + 'leds/comando';
    const payload = JSON.stringify({ led1: led1Switch.checked });
    mqttClient.publish(topic, payload);
});

// Controle do LED 2
led2Switch.addEventListener('change', () => {
    if (!isConnected || !mqttClient) return;
    const prefix = inputPrefix.value;
    const topic = (prefix.endsWith('/') ? prefix : prefix + '/') + 'leds/comando';
    const payload = JSON.stringify({ led2: led2Switch.checked });
    mqttClient.publish(topic, payload);
});

// Controle de Cor do RGB
function updateRgbPreview() {
    const r = rgbR.value;
    const g = rgbG.value;
    const b = rgbB.value;
    
    rgbRVal.textContent = r;
    rgbGVal.textContent = g;
    rgbBVal.textContent = b;
    
    rgbPreview.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    rgbPreview.style.boxShadow = `0 0 15px rgba(${r}, ${g}, ${b}, 0.5)`;
}

// Envia comandos RGB com controle de frequência (Throttle) para evitar flooding
let rgbPublishTimer = null;

function handleRgbChange() {
    updateRgbPreview();
    
    if (rgbPublishTimer) return; // Aguarda o delay para publicar novamente
    
    rgbPublishTimer = setTimeout(() => {
        rgbPublishTimer = null;
        if (!isConnected || !mqttClient) return;
        
        const r = rgbR.value;
        const g = rgbG.value;
        const b = rgbB.value;
        
        const prefix = inputPrefix.value;
        const topic = (prefix.endsWith('/') ? prefix : prefix + '/') + 'rgb/comando';
        const payload = `${r},${g},${b}`;
        
        mqttClient.publish(topic, payload);
    }, 100); // Limita o envio de comandos RGB a no máximo 10 mensagens por segundo
}

rgbR.addEventListener('input', handleRgbChange);
rgbG.addEventListener('input', handleRgbChange);
rgbB.addEventListener('input', handleRgbChange);

// Botão de Reset Mín/Máx
btnResetMinMax.addEventListener('click', () => {
    if (!isConnected || !mqttClient) return;
    const prefix = inputPrefix.value;
    const topic = (prefix.endsWith('/') ? prefix : prefix + '/') + 'controle/reset';
    mqttClient.publish(topic, 'reset');
});
