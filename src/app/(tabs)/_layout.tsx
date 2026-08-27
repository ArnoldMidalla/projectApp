import { Tabs } from 'expo-router';
import { Home, BarChart2, Settings } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const icons = [Home, BarChart2, Settings];

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={[
        styles.pill,
        {
          backgroundColor: isDark ? '#1C1C1E' : '#ffffff',
          shadowColor: isDark ? '#000' : '#000',
        }
      ]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const Icon = icons[index];

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const activeColor = isDark ? '#00D15E' : '#000';
          const inactiveColor = isDark ? '#555555' : '#AAAAAA';

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabButton}
              activeOpacity={0.7}
            >
              {isFocused ? (
                <View style={[
                  styles.activeIndicator,
                  { backgroundColor: isDark ? '#00D15E15' : '#00000008' }
                ]}>
                  <Icon
                    color={activeColor}
                    size={22}
                    fill={activeColor}
                    strokeWidth={2}
                  />
                </View>
              ) : (
                <Icon
                  color={inactiveColor}
                  size={22}
                  fill="none"
                  strokeWidth={1.5}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 40,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  tabButton: {
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    padding: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
