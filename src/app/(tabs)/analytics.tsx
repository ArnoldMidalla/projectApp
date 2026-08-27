import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';
import { useColorScheme } from 'nativewind';
import { ref, onValue } from 'firebase/database';
import { db } from '../../config/firebase';
import { 
  Tv, 
  Wind, 
  Droplets, 
  Plug, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Zap,
  Info
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [showBaseline, setShowBaseline] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [rawHistory, setRawHistory] = useState<any>(null);
  
  // Real-time DB Fetch
  useEffect(() => {
    const unsubMetrics = onValue(ref(db, 'meter/metrics'), (snapshot) => {
      if (snapshot.exists()) setMetrics(snapshot.val());
    });
    const unsubHistory = onValue(ref(db, 'meter/hourly'), (snapshot) => {
      if (snapshot.exists()) setRawHistory(snapshot.val());
    });
    return () => {
      unsubMetrics();
      unsubHistory();
    };
  }, []);

  // Set battery capacity for SoC calculation
  const BATTERY_CAPACITY_KWH = 2.4;

  // Calculate dynamic SoC curve from hourly energy consumption
  let dynamicChartData = [{ value: 100 }];
  let currentSoC = 100;
  let avgSoC = 100;

  if (rawHistory) {
    const historyArray = Object.values(rawHistory) as any[];
    // Sort chronologically
    historyArray.sort((a, b) => (a.period || '').localeCompare(b.period || ''));
    
    // We only take the last 10 hours for the chart
    const recentHistory = historyArray.slice(-10);
    
    // Calculate SoC backwards or forwards. Let's start at 100% and subtract hourly consumption
    let tempSoC = 100;
    const computedData = recentHistory.map((item) => {
      const consumed = item.energy_delta_kwh || 0;
      // Drain SoC based on consumption vs capacity
      tempSoC = Math.max(0, tempSoC - (consumed / BATTERY_CAPACITY_KWH) * 100);
      return { value: Number(tempSoC.toFixed(1)) };
    });
    
    if (computedData.length > 0) {
      dynamicChartData = computedData;
      avgSoC = computedData.reduce((acc, curr) => acc + curr.value, 0) / computedData.length;
    }
  }

  // Current live SoC based on today's total energy
  if (metrics?.energy_today) {
    currentSoC = Math.max(0, 100 - (metrics.energy_today / BATTERY_CAPACITY_KWH) * 100);
  } else if (dynamicChartData.length > 0) {
    currentSoC = dynamicChartData[dynamicChartData.length - 1].value;
  }
  
  // Relay States
  const [relays, setRelays] = useState([
    { id: '1', name: 'Entertainment', power: '0.0 kW', state: 'OFF', icon: Tv },
    { id: '2', name: 'HVAC System', power: '2.4 kW', state: 'AUTO', icon: Wind },
    { id: '3', name: 'Water Heater', power: '0.0 kW', state: 'AUTO', icon: Droplets },
    { id: '4', name: 'EV Charger', power: '7.2 kW', state: 'ON', icon: Plug },
  ]);

  const cycleRelayState = (index: number) => {
    const states: ('AUTO' | 'ON' | 'OFF')[] = ['AUTO', 'ON', 'OFF'];
    setRelays(prev => {
      const newRelays = [...prev];
      const currentStateIndex = states.indexOf(newRelays[index].state as any);
      newRelays[index].state = states[(currentStateIndex + 1) % 3];
      return newRelays;
    });
  };

  const baselineData = [
    { value: 100 }, { value: 90 }, { value: 75 }, { value: 50 },
    { value: 30 }, { value: 25 }, { value: 15 }, { value: 10 },
    { value: 40 }, { value: 85 }
  ];

  // Logs
  const events = [
    { time: '14:22', title: 'Load Shed: Entertainment', reason: 'SoC dropped below 30%, load demand critical.', type: 'shed' },
    { time: '13:05', title: 'Load Restored: HVAC', reason: 'Solar generation peaked, SoC stabilized at 45%.', type: 'restore' },
    { time: '09:15', title: 'Load Shed: EV Charger', reason: 'Grid frequency dip detected, predictive shed applied.', type: 'shed' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#111111' : '#FAFAFA' }} edges={['top', 'left', 'right']}>
      <ScrollView className="flex-1" contentContainerClassName="p-6 pb-32" showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6 mt-2.5">
          <Text className="font-bold text-2xl text-black dark:text-white">Analytics</Text>
          <TouchableOpacity className="p-2 bg-black/5 dark:bg-white/10 rounded-full">
            <Info color={isDark ? '#A3A3A3' : '#666'} size={20} />
          </TouchableOpacity>
        </View>

        {/* Main Chart Card */}
        <View className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5 mb-6 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-1">State of Charge (Current vs Avg)</Text>
              <Text className="font-bold text-2xl text-black dark:text-white">{currentSoC.toFixed(1)}% <Text className="text-sm font-regular text-[#888]">({avgSoC.toFixed(1)}% Avg)</Text></Text>
            </View>
            <View className="flex-row items-center bg-[#F5F5F5] dark:bg-[#2C2C2E] rounded-full px-3 py-1.5">
              <Text className="font-medium text-[10px] text-black dark:text-[#E4E4E7] mr-2">vs Baseline</Text>
              <Switch 
                value={showBaseline} 
                onValueChange={setShowBaseline}
                trackColor={{ false: '#ccc', true: '#00D15E' }}
                thumbColor="#fff"
                style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
              />
            </View>
          </View>

          <View className="items-center -ml-2 overflow-hidden">
            <LineChart
              areaChart
              data={dynamicChartData}
              data2={showBaseline ? baselineData : undefined}
              color1={isDark ? '#00D15E' : '#177AD5'}
              color2={isDark ? '#FF453A' : '#FF3B30'}
              startFillColor1={isDark ? '#00D15E' : '#177AD5'}
              endFillColor1={isDark ? '#00D15E' : '#177AD5'}
              startOpacity={0.2}
              endOpacity={0.0}
              thickness={3}
              hideDataPoints
              hideRules
              hideYAxisText
              hideAxesAndRules
              width={width - 70}
              height={120}
              spacing={(width - 70) / Math.max(1, dynamicChartData.length - 1)}
              curved
              isAnimated
              initialSpacing={0}
              endSpacing={0}
              yAxisThickness={0}
              xAxisThickness={0}
              pointerConfig={{
                pointerStripHeight: 140,
                pointerStripColor: isDark ? '#A3A3A3' : '#888',
                pointerStripWidth: 1,
                pointerColor: isDark ? '#00D15E' : '#177AD5',
                radius: 5,
                pointerLabelWidth: 90,
                pointerLabelHeight: showBaseline ? 45 : 30,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items: any) => {
                  return (
                    <View className="bg-black dark:bg-white rounded-lg p-2 justify-center items-start -ml-6 shadow-md">
                      <View className="flex-row items-center mb-0.5">
                        <View className={`w-2 h-2 rounded-full mr-1.5 ${isDark ? 'bg-[#00D15E]' : 'bg-[#177AD5]'}`} />
                        <Text className="text-white dark:text-black font-bold text-[10px]">
                          Fuzzy: {items[0]?.value}%
                        </Text>
                      </View>
                      {showBaseline && items[1] && (
                        <View className="flex-row items-center">
                          <View className={`w-2 h-2 rounded-full mr-1.5 ${isDark ? 'bg-[#FF453A]' : 'bg-[#FF3B30]'}`} />
                          <Text className="text-[#CCC] dark:text-[#666] font-bold text-[10px]">
                            Base: {items[1]?.value}%
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                },
              }}
            />
          </View>
          
          {showBaseline && (
            <View className="flex-row justify-center mt-4 space-x-6">
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-[#00D15E] mr-2" />
                <Text className="font-regular text-xs text-[#888] dark:text-[#A3A3A3]">POA-Fuzzy</Text>
              </View>
              <View className="flex-row items-center ml-4">
                <View className="w-2 h-2 rounded-full bg-[#FF453A] mr-2" />
                <Text className="font-regular text-xs text-[#888] dark:text-[#A3A3A3]">Fixed Baseline</Text>
              </View>
            </View>
          )}
        </View>

        {/* Small Metrics Row */}
        <View className="flex-row justify-between mb-8">
          <View className="flex-1 bg-white dark:bg-[#1C1C1E] rounded-2xl p-3 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E] mr-2">
            <View className="flex-row items-center mb-2">
              <Activity color={isDark ? '#00D15E' : '#177AD5'} size={14} />
              <Text className="font-medium text-[10px] text-[#888] dark:text-[#A3A3A3] ml-1">Satisfaction</Text>
            </View>
            <Text className="font-bold text-base text-black dark:text-white">94.2%</Text>
          </View>
          <View className="flex-1 bg-white dark:bg-[#1C1C1E] rounded-2xl p-3 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E] mx-1">
            <View className="flex-row items-center mb-2">
              <TrendingDown color="#FF453A" size={14} />
              <Text className="font-medium text-[10px] text-[#888] dark:text-[#A3A3A3] ml-1">DoD Depth</Text>
            </View>
            <Text className="font-bold text-base text-black dark:text-white">35%</Text>
          </View>
          <View className="flex-1 bg-white dark:bg-[#1C1C1E] rounded-2xl p-3 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E] ml-2">
            <View className="flex-row items-center mb-2">
              <Zap color="#F5A623" size={14} />
              <Text className="font-medium text-[10px] text-[#888] dark:text-[#A3A3A3] ml-1">Deep Cycles</Text>
            </View>
            <Text className="font-bold text-base text-black dark:text-white">3 <Text className="text-[10px] font-regular text-[#888]">/wk</Text></Text>
          </View>
        </View>

        {/* Relay Controls Grid */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="font-bold text-[17px] text-black dark:text-white">Relay-Controlled Groups</Text>
        </View>
        <View className="flex-row flex-wrap justify-between mb-4">
          {relays.map((relay, index) => (
            <View key={relay.id} className="w-[48%] bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 mb-4 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
              <View className="mb-2">
                <relay.icon color={isDark ? '#00D15E' : '#333'} size={20} />
              </View>
              <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-3" numberOfLines={1}>{relay.name}</Text>
              
              <View className="flex-row justify-between items-end">
                <Text className="font-bold text-sm text-black dark:text-white">{relay.power}</Text>
                
                <TouchableOpacity 
                  onPress={() => cycleRelayState(index)}
                  className={`px-2 py-1 rounded-md ${
                    relay.state === 'AUTO' 
                      ? 'bg-[#EAE0FF] dark:bg-[#2C2C2E]' 
                      : relay.state === 'ON' 
                        ? 'bg-[#E8F5E1] dark:bg-[#00D15E]/20' 
                        : 'bg-[#FEECEB] dark:bg-[#FF453A]/20'
                  }`}
                >
                  <Text className={`font-bold text-[10px] ${
                    relay.state === 'AUTO' 
                      ? 'text-[#6B4EFF] dark:text-white' 
                      : relay.state === 'ON' 
                        ? 'text-[#5C9A43] dark:text-[#00D15E]' 
                        : 'text-[#FF3B30] dark:text-[#FF453A]'
                  }`}>
                    {relay.state}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Event Logs */}
        <View className="flex-row justify-between items-center mb-4 mt-2">
          <Text className="font-bold text-[17px] text-black dark:text-white">Recent Fuzzy Decisions</Text>
        </View>
        <View className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5 mb-6 shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
          {events.map((ev, i) => (
            <View key={i} className={`flex-row ${i !== events.length - 1 ? 'mb-5' : ''}`}>
              <View className="items-center mr-4">
                <View className={`w-2 h-2 rounded-full mt-1.5 ${ev.type === 'shed' ? 'bg-[#FF453A]' : 'bg-[#00D15E]'}`} />
                {i !== events.length - 1 && <View className="w-[1px] flex-1 bg-[#EEE] dark:bg-[#333] mt-2" />}
              </View>
              <View className="flex-1">
                <View className="flex-row justify-between items-start mb-1">
                  <Text className="font-bold text-sm text-black dark:text-[#E4E4E7] flex-1">{ev.title}</Text>
                  <Text className="font-medium text-[10px] text-[#888] dark:text-[#666] ml-2">{ev.time}</Text>
                </View>
                <Text className="font-regular text-xs text-[#666] dark:text-[#A3A3A3] leading-relaxed">
                  {ev.reason}
                </Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
