import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getStorage } from './storage';
import { setAuthTokenGetter, getMe, type User } from './api';

const TOKEN_KEY = 'recordbook_token';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set up auth token getter for API client
  useEffect(() => {
    setAuthTokenGetter(async () => {
      const storage = await getStorage();
      return await storage.getItem(TOKEN_KEY);
    });
  }, []);

  // Simplified session restoration
  useEffect(() => {
    let isMounted = true;
    console.log('[Auth] Startup...');

    const init = async () => {
      try {
        const storage = await getStorage();
        // User requested manual sign-in every time app opens
        // Disabled auto session logic
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } catch (err: any) {
        console.log('[Auth] Storage error:', err.message);
      } finally {
        if (isMounted) {
          console.log('[Auth] Ready.');
          setIsLoading(false);
        }
      }
    };

    init();
    
    // Safety fallback: always stop loading after a short bit
    const timer = setTimeout(() => {
      if (isMounted && isLoading) {
        console.log('[Auth] Safety timeout.');
        setIsLoading(false);
      }
    }, 1500);

    return () => { 
      isMounted = false; 
      clearTimeout(timer);
    };
  }, []);

  const login = useCallback(async (newToken: string, newUser: User) => {
    const storage = await getStorage();
    await storage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    const storage = await getStorage();
    await storage.deleteItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
