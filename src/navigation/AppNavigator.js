import React, { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ScaledSheet, moderateScale, verticalScale } from 'react-native-size-matters';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FocusScreen from '../screens/FocusScreen';
import CalendarScreen from '../screens/CalendarScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import AchievementsScreen from '../screens/AchievementsScreen';

import AppIcon from '../components/AppIcon';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const styles = ScaledSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '24@vs',
  },
  activeTabIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#06B6D4',
    marginTop: 3,
  },
});

const TabBarIcon = ({ routeName, focused }) => {
  let iconName = 'home';
  if (routeName === 'Home') iconName = 'home';
  else if (routeName === 'Focus') iconName = 'timer';
  else if (routeName === 'Calendar') iconName = 'calendar';
  else if (routeName === 'Analytics') iconName = 'chart';
  else if (routeName === 'Achievements') iconName = 'trophy';
  else if (routeName === 'Profile') iconName = 'profile';

  const iconColor = focused ? '#06B6D4' : '#64748B';

  return (
    <View style={styles.tabIconContainer}>
      <AppIcon
        name={iconName}
        size={moderateScale(19)}
        color={iconColor}
        strokeWidth={focused ? 2.2 : 1.8}
      />
      {focused && <View style={styles.activeTabIndicator} />}
    </View>
  );
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D1017',
          borderTopColor: '#1A1F2C',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? verticalScale(70) : verticalScale(58),
          paddingBottom: Platform.OS === 'ios' ? moderateScale(14) : moderateScale(5),
          paddingTop: moderateScale(5),
          elevation: 6,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
        },
        tabBarActiveTintColor: '#06B6D4',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: moderateScale(9.5),
          fontWeight: '700',
          letterSpacing: 0.2,
        },
        // eslint-disable-next-line react/no-unstable-nested-components
        tabBarIcon: ({ focused }) => (
          <TabBarIcon routeName={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Focus" component={FocusScreen} options={{ tabBarLabel: 'Focus' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarLabel: 'Planner' }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ tabBarLabel: 'Stats' }} />
      <Tab.Screen name="Achievements" component={AchievementsScreen} options={{ tabBarLabel: 'Badges' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (currentUser) {
        try {
          await currentUser.getIdToken(true);
        } catch (error) {
          console.warn('Startup token refresh failed:', error);
        }
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
          />
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
            />
            <Stack.Screen
              name="Signup"
              component={SignupScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}