"use client"

import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';

type User = {
  id: string;
  username: string;
  email: string;
  is_email_verified: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

const publicRoutes = ['/login', '/register', '/forgot-password'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    router.push('/login');
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      
      // Если нет токена и маршрут не публичный, перенаправляем на страницу входа
      if (!token) {
        setIsLoading(false);
        if (!publicRoutes.includes(pathname)) {
          router.push('/login');
        }
        return;
      }
      
      // Проверяем токен и получаем данные пользователя
      try {
        const response = await api.get('/users/me/');
        setUser(response.data);
        
        // Если пользователь на странице входа или регистрации, перенаправляем на корневой документ
        if (publicRoutes.includes(pathname)) {
          router.push('/');
        }
      } catch (error) {
        console.error('Ошибка авторизации:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [pathname]);

  return (
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
} 