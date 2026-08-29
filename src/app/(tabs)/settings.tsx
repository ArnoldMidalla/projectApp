import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { ref, onValue } from 'firebase/database';
import { db } from '../../config/firebase';

interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

const SettingsGroup = ({ title, children }: SettingsGroupProps) => (
  <View className="mb-6">
    <Text className="font-medium text-xs text-[#888] dark:text-[#A3A3A3] mb-2 ml-4 uppercase tracking-wider">
      {title}
    </Text>
    <View className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-md shadow-black/5 dark:shadow-none border border-[#F0F0F0] dark:border-[#2C2C2E]">
      {children}
    </View>
  </View>
);

interface SettingsRowProps {
  label: string;
  value?: React.ReactNode;
  isLast?: boolean;
  type?: 'link' | 'toggle' | 'input' | 'segment';
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  inputValue?: string;
  onInputChange?: (val: string) => void;
  segmentOptions?: string[];
  activeSegment?: string;
  onSegmentChange?: (val: string) => void;
  isDark?: boolean;
}

const SettingsRow = ({ 
  label, 
  value, 
  isLast = false, 
  type = 'link',
  toggleValue,
  onToggle,
  inputValue,
  onInputChange,
  segmentOptions,
  activeSegment,
  onSegmentChange,
  isDark
}: SettingsRowProps) => {
  return (
    <View className={`flex-row justify-between items-center p-4 bg-white dark:bg-[#1C1C1E] ${!isLast ? 'border-b border-[#F0F0F0] dark:border-[#2C2C2E]' : ''}`}>
      <Text className="font-medium text-[15px] text-black dark:text-white flex-1">
        {label}
      </Text>
      
      <View className="flex-row items-center justify-end flex-1">
        {type === 'link' && (
          <>
            {value && <Text className="font-regular text-[15px] text-[#888] dark:text-[#A3A3A3] mr-2 text-right">{value}</Text>}
            <ChevronRight size={18} color={isDark ? '#666' : '#CCC'} />
          </>
        )}

        {type === 'toggle' && (
          <Switch 
            value={toggleValue} 
            onValueChange={onToggle}
            trackColor={{ false: '#ccc', true: '#00D15E' }}
            thumbColor="#fff"
            style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
          />
        )}

        {type === 'input' && (
          <TextInput
            value={inputValue}
            onChangeText={onInputChange}
            className="font-regular text-[15px] text-[#888] dark:text-[#A3A3A3] min-w-[80px]"
            style={{ textAlign: 'right' }}
            keyboardType="numeric"
            returnKeyType="done"
          />
        )}

        {type === 'segment' && segmentOptions && (
          <View className="flex-row bg-[#F2F2F6] dark:bg-[#2C2C2E] rounded-lg p-1">
            {segmentOptions.map((opt) => {
              const isActive = activeSegment === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => onSegmentChange?.(opt)}
                  className={`px-4 py-1.5 rounded-md will-change-transform ${isActive ? 'bg-white dark:bg-[#444] shadow-sm' : ''}`}
                >
                  <Text className={`font-medium text-[13px] ${isActive ? 'text-black dark:text-white' : 'text-[#888] dark:text-[#A3A3A3]'}`}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

export default function SettingsScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Live Firebase connection status
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    const unsub = onValue(connectedRef, (snap) => {
      setIsConnected(snap.val() === true);
    });
    return () => unsub();
  }, []);

  // State for form values
  const [notifications, setNotifications] = useState(true);
  const [socCritical, setSocCritical] = useState('22%');
  const [socTarget, setSocTarget] = useState('85%');
  const [capacity, setCapacity] = useState('2.4 kWh');
  const [alpha, setAlpha] = useState('0.30');
  const [beta, setBeta] = useState('0.50');
  const [gamma, setGamma] = useState('0.20');
  
  // ML State
  const [mlModel, setMlModel] = useState('RF');
  const [edgeInference, setEdgeInference] = useState(true);
  const [fuzzyEnabled, setFuzzyEnabled] = useState(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#111111' : '#FAFAFA' }} edges={['top', 'left', 'right']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-32" showsVerticalScrollIndicator={false}>
        
        <Text className="font-bold text-3xl text-black dark:text-white mb-6 ml-2 mt-2">
          Settings
        </Text>

        <SettingsGroup title="IoT Data Architecture">
          <SettingsRow label="Database Status" value={isConnected ? 'Connected 🟢' : 'Offline 🔴'} isDark={isDark} />
          <SettingsRow label="Data Source" value="Firebase RTDB" isDark={isDark} />
          <SettingsRow label="Sync Frequency" value="Real-time (WebSockets)" isLast isDark={isDark} />
        </SettingsGroup>

        <SettingsGroup title="Battery Parameters">
          <SettingsRow 
            label="Total Capacity" 
            type="input"
            inputValue={capacity}
            onInputChange={setCapacity}
            isDark={isDark} 
          />
          <SettingsRow 
            label="Critical SoC Threshold" 
            type="input"
            inputValue={socCritical}
            onInputChange={setSocCritical}
            isDark={isDark} 
          />
          <SettingsRow 
            label="Target SoC" 
            type="input"
            inputValue={socTarget}
            onInputChange={setSocTarget}
            isLast 
            isDark={isDark} 
          />
        </SettingsGroup>

        <SettingsGroup title="Machine Learning & Prediction">
          <SettingsRow 
            label="Forecasting Model" 
            type="segment" 
            segmentOptions={['RF', 'GBM', 'ARIMA']}
            activeSegment={mlModel}
            onSegmentChange={setMlModel}
            isDark={isDark} 
          />
          <SettingsRow 
            label="Run inference on-device" 
            type="toggle" 
            toggleValue={edgeInference}
            onToggle={setEdgeInference}
            isLast
            isDark={isDark} 
          />
        </SettingsGroup>

        <SettingsGroup title="Fuzzy Logic & POA Control">
          <SettingsRow 
            label="Enable Fuzzy Logic Overrides" 
            type="toggle" 
            toggleValue={fuzzyEnabled}
            onToggle={setFuzzyEnabled}
            isDark={isDark} 
          />
          <SettingsRow 
            label="α (Critical Load Bias)" 
            type="input"
            inputValue={alpha}
            onInputChange={setAlpha}
            isDark={isDark} 
          />
          <SettingsRow 
            label="β (Solar Utilization)" 
            type="input"
            inputValue={beta}
            onInputChange={setBeta}
            isDark={isDark} 
          />
          <SettingsRow 
            label="γ (Battery Preservation)" 
            type="input"
            inputValue={gamma}
            onInputChange={setGamma}
            isLast 
            isDark={isDark} 
          />
        </SettingsGroup>

        <SettingsGroup title="Preferences">
          <SettingsRow 
            label="Notifications" 
            type="toggle" 
            toggleValue={notifications}
            onToggle={setNotifications}
            isDark={isDark} 
          />
          <SettingsRow 
            label="Theme" 
            type="segment" 
            segmentOptions={['Light', 'Dark']}
            activeSegment={isDark ? 'Dark' : 'Light'}
            onSegmentChange={(val) => setColorScheme(val.toLowerCase() as 'light' | 'dark')}
            isLast 
            isDark={isDark} 
          />
        </SettingsGroup>
        
        <SettingsGroup title="System">
          <SettingsRow label="Export Diagnostic Logs" value="CSV" isDark={isDark} />
          <SettingsRow label="Firmware Version" value="v1.0.0 (POA-Fuzzy-ML Core)" isLast isDark={isDark} />
        </SettingsGroup>

      </ScrollView>
    </SafeAreaView>
  );
}
