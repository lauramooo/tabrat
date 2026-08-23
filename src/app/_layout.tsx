import '../global.css';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CircleIconButton } from '@/components/design';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureFonts, MD3LightTheme, PaperProvider } from 'react-native-paper';
import { C } from '@/constants/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

const fontConfig = {
  displayLarge:  { fontFamily: 'Poppins_900Black', letterSpacing: 0 },
  displayMedium: { fontFamily: 'Poppins_900Black', letterSpacing: 0 },
  displaySmall:  { fontFamily: 'Poppins_900Black', letterSpacing: 0 },
  headlineLarge:  { fontFamily: 'Poppins_900Black', letterSpacing: 0 },
  headlineMedium: { fontFamily: 'Poppins_900Black', letterSpacing: 0 },
  headlineSmall:  { fontFamily: 'Poppins_900Black', letterSpacing: 0 },
  titleLarge:  { fontFamily: 'Poppins_600SemiBold' },
  titleMedium: { fontFamily: 'Poppins_600SemiBold' },
  titleSmall:  { fontFamily: 'Poppins_500Medium' },
  bodyLarge:   { fontFamily: 'Poppins_400Regular' },
  bodyMedium:  { fontFamily: 'Poppins_400Regular' },
  bodySmall:   { fontFamily: 'Poppins_400Regular' },
  labelLarge:  { fontFamily: 'Poppins_500Medium' },
  labelMedium: { fontFamily: 'Poppins_500Medium' },
  labelSmall:  { fontFamily: 'Poppins_400Regular' },
};

const paperTheme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary: '#000000',
    onPrimary: '#FFFFFF',
    primaryContainer: '#F5F2EB',
    onPrimaryContainer: '#000000',
    secondary: '#5FA876',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E4F2EC',
    onSecondaryContainer: '#000000',
    background: C.bg,
    onBackground: '#1A1A1A',
    surface: C.card,
    onSurface: '#000000',
    surfaceVariant: '#F5F2EB',
    onSurfaceVariant: '#606060',
    outline: '#E8E6E1',
    outlineVariant: '#E8E6E1',
    error: '#D95F52',
    onError: '#FFFFFF',
    errorContainer: '#FDECEA',
    onErrorContainer: '#1A1A1A',
  },
};

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Poppins_900Black,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
      <PaperProvider
        theme={paperTheme}
        settings={{
          icon: ({ name, color, size }) => (
            <MaterialCommunityIcons
              name={name as keyof typeof MaterialCommunityIcons.glyphMap}
              color={color}
              size={size}
            />
          ),
        }}
      >
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: 'transparent' },
            headerTransparent: true,
            headerTintColor: C.text,
            headerTitleStyle: { fontFamily: 'Poppins_900Black', fontSize: 20, color: C.text },
            contentStyle: { backgroundColor: 'transparent' },
            headerShadowVisible: false,
            headerLeft: () => (
              <CircleIconButton variant="back" size={28} color={C.text} onPress={() => router.back()} style={{ paddingHorizontal: 12 }} />
            ),
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
          <Stack.Screen name="upload" options={{ title: 'Upload' }} />
          <Stack.Screen name="review" options={{ title: 'Review items' }} />
          <Stack.Screen name="people" options={{ title: 'Add friends' }} />
          <Stack.Screen name="assign" options={{ title: 'Assign items' }} />
          <Stack.Screen name="summary" options={{ title: 'Summary' }} />
          <Stack.Screen name="groups" options={{ title: 'Groups' }} />
          <Stack.Screen name="tabs" options={{ title: 'Split history' }} />
          <Stack.Screen name="friends" options={{ title: 'Friends' }} />
          <Stack.Screen name="trip/new" options={{ title: 'New trip' }} />
          <Stack.Screen name="trip/[id]" options={{ title: 'Trips', headerBackTitle: 'Trips' }} />
          <Stack.Screen name="trip/expense" options={{ title: 'Add expense' }} />
          <Stack.Screen name="trip/manual-entry" options={{ title: 'Add expense', headerBackTitle: 'Trip' }} />
          <Stack.Screen name="trip/edit-categories" options={{ title: 'Edit categories' }} />
          <Stack.Screen name="expense-entry" options={{ title: 'New expense' }} />
          <Stack.Screen name="home/new" options={{ title: 'New home' }} />
          <Stack.Screen name="home/[id]" options={{ title: 'Home' }} />
          <Stack.Screen name="home/edit-categories" options={{ title: 'Edit categories' }} />
        </Stack>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
