// Platform-aware storage adapter
// Uses localStorage on web, SecureStore on native
import { Platform } from 'react-native';

interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
}

function createWebStorage(): StorageAdapter {
  return {
    getItem: async (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
    deleteItem: async (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };
}

async function createNativeStorage(): Promise<StorageAdapter> {
  const SecureStore = await import('expo-secure-store');
  return {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    deleteItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
}

let _storage: StorageAdapter | null = null;

export async function getStorage(): Promise<StorageAdapter> {
  if (_storage) return _storage;

  if (Platform.OS === 'web') {
    _storage = createWebStorage();
  } else {
    _storage = await createNativeStorage();
  }

  return _storage;
}
