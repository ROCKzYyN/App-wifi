import { StyleSheet, Dimensions, Platform } from 'react-native';

export const screenWidth = Dimensions.get('window').width;

// Configuração visual padrão dos gráficos
export const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#007AFF' }
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Tela principal flexível, com margem maior na parte inferior do Android para evitar botões virtuais do sistema
  screen: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'android' ? 50 : 30, 
  },

  // Área de scroll com respiro seguro na rolagem para evitar sobreposição dos botões de controle
  scrollContent: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'android' ? 60 : 40,
  },

  header: { 
    backgroundColor: '#007AFF', 
    padding: 20, 
    alignItems: 'center', 
    paddingTop: Platform.OS === 'android' ? 40 : 50 
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  connectionStatus: { color: '#E0F7FA', fontSize: 12, marginTop: 5 },
  scrollView: { flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  card: { flex: 1, padding: 15, borderRadius: 12, marginHorizontal: 5, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  cardLabel: { fontSize: 14, color: '#555', fontWeight: '600' },
  cardValue: { fontSize: 26, fontWeight: 'bold', color: '#222', marginVertical: 5 },
  cardSub: { fontSize: 11, color: '#666' },
  chartTitle: { alignSelf: 'flex-start', fontSize: 16, fontWeight: 'bold', color: '#444', marginTop: 15, marginBottom: 8 },
  chart: { borderRadius: 12, elevation: 2, marginBottom: 10 },
  buttonGroup: { width: '100%', marginTop: 15 },
  list: { width: '100%', marginBottom: 20 },
  deviceCard: { backgroundColor: '#fff', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, elevation: 2 },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  deviceMac: { fontSize: 12, color: '#999' },
  connectLink: { color: '#007AFF', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 40 },
  ledControlCard: { backgroundColor: '#fff', width: '100%', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, elevation: 1 },
  ledLabel: { fontSize: 16, fontWeight: '500', color: '#333' },
  rgbContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 15 },
  rgbBtn: { width: 50, height: 50, borderRadius: 25, elevation: 3 }
});
