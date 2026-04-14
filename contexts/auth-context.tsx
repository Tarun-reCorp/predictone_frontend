"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { loginApi, signupApi, getMeApi, type AuthUser } from "@/lib/auth";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("po_token");
    if (!stored) {
      setLoading(false);
      return;
    }
    getMeApi(stored)
      .then(({ user }) => {
        setToken(stored);
        setUser(user);
      })
      .catch(() => {
        localStorage.removeItem("po_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = (token: string, user: AuthUser) => {
    localStorage.setItem("po_token", token);
    setToken(token);
    setUser(user);
  };

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const data = await loginApi(email, password);
    persist(data.token, data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string): Promise<AuthUser> => {
    const data = await signupApi(name, email, password);
    persist(data.token, data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("po_token");
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updated: AuthUser) => {
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
