// src/context/AuthContext.tsx
import React, { createContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export interface User {
  id: number;
  email: string;
  full_name?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string, remember?: boolean) => void;
  logout: () => void;
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  isAuthenticated: boolean;
}

const KEY_USER = "user";
const KEY_TOKEN = "token";
// Vite env: gunakan VITE_API_BASE di file .env (root)
const BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  authFetch: async () => new Response(),
  isAuthenticated: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  // load from either localStorage or sessionStorage
  const loadStored = <T,>(key: string): T | null => {
    try {
      const a = localStorage.getItem(key);
      if (a) return JSON.parse(a) as T;
    } catch {}
    try {
      const b = sessionStorage.getItem(key);
      if (b) return JSON.parse(b) as T;
    } catch {}
    return null;
  };

  const [user, setUser] = useState<User | null>(() => loadStored<User>(KEY_USER));
  const [token, setToken] = useState<string | null>(() => {
    const tLocal = localStorage.getItem(KEY_TOKEN);
    if (tLocal) return tLocal;
    return sessionStorage.getItem(KEY_TOKEN);
  });

  useEffect(() => {
    // keep local copies in storage only when set via login()
    // outside direct set, don't sync to prevent accidental overwrites
  }, []);

  const login = (userData: User, jwt: string, remember = true) => {
    setUser(userData);
    setToken(jwt);
    if (remember) {
      try {
        localStorage.setItem(KEY_USER, JSON.stringify(userData));
        localStorage.setItem(KEY_TOKEN, jwt);
      } catch (e) {
        console.warn("Failed to write to localStorage", e);
      }
    } else {
      try {
        sessionStorage.setItem(KEY_USER, JSON.stringify(userData));
        sessionStorage.setItem(KEY_TOKEN, jwt);
      } catch (e) {
        console.warn("Failed to write to sessionStorage", e);
      }
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem(KEY_USER);
      localStorage.removeItem(KEY_TOKEN);
      sessionStorage.removeItem(KEY_USER);
      sessionStorage.removeItem(KEY_TOKEN);
    } catch (e) {
      console.warn("Failed to clear storage", e);
    }
    // redirect user to login page
    navigate("/login");
  };

  const authFetch = async (input: RequestInfo, init: RequestInit = {}) => {
    // if input is relative path, prefix base
    let url = typeof input === "string" ? input : (input as Request).url;
    if (typeof input === "string" && input.startsWith("/")) {
      url = BASE + input;
    }

    const headers = new Headers(init.headers || {});
    // If body exists and content-type not set, assume json
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(url, {
      ...init,
      headers,
      // default credentials: include only if you use cookies; keep same-origin otherwise
      credentials: init.credentials ?? "same-origin",
    });

    // auto logout on 401 (token expired / invalid)
    if (res.status === 401) {
      logout();
    }

    return res;
  };

  // helper untuk axios if needed
  const setAxiosAuthHeader = (axiosInstance: any) => {
    if (token) axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    else delete axiosInstance.defaults.headers.common["Authorization"];
  };

  const value = useMemo(
    () => ({ user, token, login, logout, authFetch, isAuthenticated: !!token }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
