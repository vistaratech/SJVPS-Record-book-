import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../lib/auth';
import { Colors } from '../constants/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" backgroundColor={Colors.navy} />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: Colors.navy,
            },
            headerTintColor: Colors.white,
            headerBackButtonDisplayMode: 'minimal',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
            },
            contentStyle: {
              backgroundColor: Colors.background,
            },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen
            name="index"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="register/[id]"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="templates/index"
            options={{
              title: 'Create New Register',
              headerBackButtonDisplayMode: 'minimal',
              headerStyle: { backgroundColor: Colors.navy },
              headerTintColor: Colors.white,
            }}
          />
          <Stack.Screen
            name="templates/[categoryId]"
            options={{
              title: 'Choose Template',
              headerBackButtonDisplayMode: 'minimal',
              presentation: 'modal',
              headerStyle: { backgroundColor: Colors.navy },
              headerTintColor: Colors.white,
            }}
          />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
