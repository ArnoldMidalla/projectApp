import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { Sun, Moon, Zap, ChevronDown, Cpu, Hand, Activity, Thermometer, Droplets, ZapOff } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { db } from '../../config/firebase';
import { ref, onValue, set } from 'firebase/database';

export default function HomeScreen() {
  const [isSmartMode, setIsSmartMode] = useState(true);
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();

  const [metrics, setMetrics] = useState<any>(null);
  const [rawHistory, setRawHistory] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState<string>('');
  const [relayState, setRelayState] = useState<string>('');

  // 1. Fetch raw data via real-time SDK
  useEffect(() => {
    let unsubMetrics = () => {};
    let unsubHistory = () => {};
    let unsubRelay = () => {};

    try {
      if (!process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL) {
        setDbStatus('Error: EXPO_PUBLIC variables missing. Restart Expo with -c');
        return;
      }

      // Point to the correct 'meter' child nodes
      const metricsRef = ref(db, 'meter/metrics');
      unsubMetrics = onValue(metricsRef, (snapshot) => {
        if (snapshot.exists()) {
          setMetrics(snapshot.val());
          setDbStatus('');
        } else {
          setDbStatus('No data at meter/metrics');
        }
      }, (error) => {
        setDbStatus('Metrics SDK Error: ' + error.message);
      });

      const historyRef = ref(db, 'meter/hourly');
      unsubHistory = onValue(historyRef, (snapshot) => {
        if (snapshot.exists()) {
          setRawHistory(snapshot.val());
        }
      }, (error) => {
        console.error("Firebase history SDK error:", error);
      });
      
      const relayRef = ref(db, 'meter/relay /state');
      unsubRelay = onValue(relayRef, (snapshot) => {
        if (snapshot.exists()) {
          setRelayState(snapshot.val());
        }
      });
      
    } catch (err: any) {
      setDbStatus('SDK Init Error: ' + err.message);
    }

    return () => {
      unsubMetrics();
      unsubHistory();
      unsubRelay();
    };
  }, []);

  // 2. Format chart data whenever raw history or theme changes
  useEffect(() => {
    if (rawHistory) {
      try {
        const formatted = Object.keys(rawHistory).map(key => {
          const item = rawHistory[key];
          return {
            value: item.energy_delta_kwh || 0,
            label: item.period ? item.period.split(' ')[1] : '',
            frontColor: isDark ? '#00D15E' : '#000',
            rawPeriod: item.period || ''
          };
        });
        
        formatted.sort((a, b) => a.rawPeriod.localeCompare(b.rawPeriod));
        setHistoryData(formatted.slice(-12));
      } catch (e) {
        setDbStatus('Error formatting graph data');
      }
    }
  }, [rawHistory, isDark]);

  // Fuzzy Logic System
  const BATTERY_CAPACITY_KWH = 2.4;
  const currentSoC = metrics ? Math.max(0, 100 - (metrics.energy_today / BATTERY_CAPACITY_KWH) * 100) : 100;
  
  const getFuzzyState = (soc: number, loadKw: number) => {
    const net_margin_kw = -loadKw;
    if (soc < 22) return { mode: 'Battery Protection', reason: 'Shedding non-essential loads due to critically low battery SoC.' };
    if (net_margin_kw < -0.25 && soc < 50) return { mode: 'Restrict Non-Essential', reason: 'Deferring non-essential loads due to low solar generation margin.' };
    if (soc > 70 && net_margin_kw > -0.05) return { mode: 'Normal Operation', reason: 'Sufficient generation and battery reserves available. All loads permitted.' };
    if (net_margin_kw < -0.05 && soc < 60) return { mode: 'Priority Load Mode', reason: 'Prioritizing essential loads to conserve remaining battery energy.' };
    return { mode: 'Normal Operation', reason: 'System operating within standard parameters.' };
  };

  const fuzzyState = getFuzzyState(currentSoC, (metrics?.power || 0) / 1000);

  const getSystemStatus = () => {
    if (currentSoC < 30) return { text: '🟠 Battery Drain Warning', bg: 'bg-[#FFF8E5] dark:bg-[#2B220D]', border: 'border-[#FF9500]', textStyle: 'text-[#FF9500]' };
    if ((metrics?.power || 0) > 1500) return { text: '🟠 High Load Warning', bg: 'bg-[#FFF8E5] dark:bg-[#2B220D]', border: 'border-[#FF9500]', textStyle: 'text-[#FF9500]' };
    return { text: '🟢 System Healthy', bg: 'bg-[#E8F8EF] dark:bg-[#0D2B1A]', border: 'border-[#00D15E]', textStyle: 'text-[#00D15E]' };
  };
  const status = getSystemStatus();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#111111' : '#FAFAFA' }} edges={['top', 'left', 'right']}>
      <ScrollView className="flex-1" contentContainerClassName="p-6 pb-32" showsVerticalScrollIndicator={false}>
        
        {/* System Alert Banner */}
        <View className={`flex-row justify-center items-center py-2 px-4 rounded-full border mb-6 ${status.bg} ${status.border}`}>
          <Text className={`font-bold text-xs uppercase tracking-wider ${status.textStyle}`}>{status.text}</Text>
        </View>

        {/* Header */}
        <View className="flex-row justify-between items-center mb-7">
          <View>
            <Text className="font-bold text-2xl text-black dark:text-white mb-1">Hello, Arnold</Text>
            <Text className="font-regular text-sm text-[#888] dark:text-[#A3A3A3]">Live System Dashboard</Text>
            {dbStatus ? <Text className="font-medium text-[10px] text-[#FF453A] mt-1">{dbStatus}</Text> : null}
          </View>
          <TouchableOpacity onPress={toggleColorScheme} className="p-2 bg-black/5 dark:bg-white/10 rounded-full">
            {isDark ? <Sun color="#fff" size={20} /> : <Moon color="#000" size={20} />}
          </TouchableOpacity>
        </View>

        {/* AI Supervisor Card */}
        <View className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5 mb-8 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
          <View className="flex-row items-center mb-3">
            <View className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 items-center justify-center mr-3">
              <Activity color={isDark ? '#00D15E' : '#177AD5'} size={16} />
            </View>
            <Text className="font-bold text-lg text-black dark:text-white">AI Supervisor Mode</Text>
          </View>
          <View className="bg-[#F2F2F6] dark:bg-[#2C2C2E] rounded-xl p-4">
            <Text className="font-bold text-base text-black dark:text-white mb-1">{fuzzyState.mode}</Text>
            <Text className="font-regular text-sm text-[#666] dark:text-[#A3A3A3] leading-5">{fuzzyState.reason}</Text>
          </View>
        </View>

        {/* Live Grid Metrics */}
        {metrics && (
          <View className="flex-row flex-wrap justify-between mb-8">
            <View className="w-[48%] bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 mb-4 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
              <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-1">Live Power</Text>
              <Text className="font-bold text-2xl text-black dark:text-white">{Number(Number(metrics.power).toFixed(4))} <Text className="text-sm">W</Text></Text>
            </View>
            <View className="w-[48%] bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 mb-4 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
              <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-1">Energy Today</Text>
              <Text className="font-bold text-2xl text-black dark:text-white">{Number(Number(metrics.energy_today).toFixed(4))} <Text className="text-sm">kWh</Text></Text>
            </View>
            <View className="w-[48%] bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
              <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-1">Voltage</Text>
              <Text className="font-bold text-2xl text-black dark:text-white">{Number(Number(metrics.voltage).toFixed(4))} <Text className="text-sm">V</Text></Text>
            </View>
            <View className="w-[48%] bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
              <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-1">Current</Text>
              <Text className="font-bold text-2xl text-black dark:text-white">{Number(Number(metrics.current).toFixed(4))} <Text className="text-sm">A</Text></Text>
            </View>
          </View>
        )}

        {/* Energy History Chart Card */}
        <View className="bg-[#EAE0FF] dark:bg-[#1C1C1E] rounded-3xl p-6 pb-4 mb-8 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
          <View className="flex-row justify-between items-start mb-6">
            <View>
              <Text className="font-bold text-base text-black dark:text-[#E4E4E7] mb-1">Hourly Consumption</Text>
              <Text className="font-regular text-[13px] text-[#444] dark:text-[#A3A3A3]">Last 12 Hours (kWh)</Text>
            </View>
            <Activity color={isDark ? '#00D15E' : '#000'} size={28} />
          </View>

          <View className="items-center -ml-3">
            {historyData.length > 0 ? (
              <BarChart
                data={historyData}
                barWidth={12}
                spacing={12}
                roundedTop
                roundedBottom
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{color: isDark ? '#A3A3A3' : '#666', fontSize: 10}}
                xAxisLabelTextStyle={{color: isDark ? '#A3A3A3' : '#666', fontSize: 9}}
                noOfSections={3}
                width={width - 120}
                height={120}
                isAnimated
                showFractionalValues
                roundToDigits={2}
              />
            ) : (
              <Text className="text-[#888] my-10">
                Loading graph... (Raw keys: {rawHistory ? Object.keys(rawHistory).length : 0}, History length: {historyData.length})
              </Text>
            )}
          </View>
        </View>

        {/* System Control Section */}
        <View className="mb-8 mt-2">
          <Text className="font-bold text-[17px] text-black dark:text-white mb-4">System Control</Text>
          
          <View className="rounded-3xl p-5 border border-[#F0F0F0] dark:border-[#2C2C2E] bg-white dark:bg-[#1C1C1E] shadow-md shadow-black/5 dark:shadow-none">
            {/* State badge + label row */}
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-1 uppercase tracking-wider">Main Relay</Text>
                <View className="flex-row items-center">
                  {relayState === 'ON'
                    ? <Zap color="#00D15E" size={20} />
                    : <ZapOff color="#FF453A" size={20} />
                  }
                  <Text className={`font-bold text-2xl ml-2 ${relayState === 'ON' ? 'text-[#00D15E]' : 'text-[#FF453A]'}`}>
                    {relayState || '—'}
                  </Text>
                </View>
              </View>

              {/* Live indicator dot */}
              <View className={`w-3 h-3 rounded-full ${relayState === 'ON' ? 'bg-[#00D15E]' : 'bg-[#FF453A]'}`} />
            </View>

            {/* Action buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => set(ref(db, 'meter/relay /state'), 'OFF')}
                disabled={relayState === 'OFF'}
                className={`flex-1 rounded-2xl py-3 items-center ${
                  relayState === 'OFF'
                    ? 'bg-[#FF453A]'
                    : 'bg-black/10 dark:bg-white/10'
                }`}
              >
                <Text className={`font-bold text-sm ${relayState === 'OFF' ? 'text-white' : 'text-[#888] dark:text-[#A3A3A3]'}`}>
                  Turn OFF
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => set(ref(db, 'meter/relay /state'), 'ON')}
                disabled={relayState === 'ON'}
                className={`flex-1 rounded-2xl py-3 items-center ${
                  relayState === 'ON'
                    ? 'bg-[#00D15E]'
                    : 'bg-black/10 dark:bg-white/10'
                }`}
              >
                <Text className={`font-bold text-sm ${relayState === 'ON' ? 'text-white' : 'text-[#888] dark:text-[#A3A3A3]'}`}>
                  Turn ON
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Auto-Switched Section */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="font-bold text-[17px] text-black dark:text-white">Currently Auto-Switched</Text>
          <View className="flex-row items-center border border-[#CCC] dark:border-[#2C2C2E] dark:bg-[#1C1C1E] rounded-2xl px-3 py-1.5">
            <Text className="font-medium text-xs text-black dark:text-[#A3A3A3] mr-1">Status</Text>
            <ChevronDown size={16} color={isDark ? '#fff' : '#000'} />
          </View>
        </View>

        <View className="flex-row justify-between mb-2">
          <View className="w-[31%] bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
            <View className="mb-2">
              <Thermometer color={isDark ? '#00D15E' : '#333'} size={18} />
            </View>
            <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-1">HVAC</Text>
            <Text className="font-bold text-xl text-black dark:text-white">ON</Text>
          </View>
          <View className="w-[31%] bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
            <View className="mb-2">
              <Droplets color={isDark ? '#00D15E' : '#333'} size={18} />
            </View>
            <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-1">Water</Text>
            <Text className="font-bold text-xl text-black dark:text-white">OFF</Text>
          </View>
          <View className="w-[31%] bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
            <View className="mb-2">
              <Zap color={isDark ? '#00D15E' : '#333'} size={18} />
            </View>
            <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-1">EV Charger</Text>
            <Text className="font-bold text-xl text-black dark:text-white">ON</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
