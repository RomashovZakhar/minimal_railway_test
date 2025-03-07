"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { 
  Search, 
  Home, 
  Star, 
  Settings, 
  User,
  LogOut,
  File
} from "lucide-react"
import { useAuth } from "@/components/auth"
import { useEffect, useState } from "react"
import api from "@/lib/api"

// Тип для документа в избранном
interface FavoriteDocument {
  id: string;
  title: string;
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()
  const [favoriteDocuments, setFavoriteDocuments] = useState<FavoriteDocument[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<FavoriteDocument[]>([])

  // Загрузка избранных документов
  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        // Проверяем, доступно ли API избранных документов
        try {
          const response = await api.get("/documents/favorites/");
          setFavoriteDocuments(response.data);
        } catch (err: any) {
          // Если API не поддерживает избранные (404), создаем заглушку
          if (err.response && err.response.status === 404) {
            console.log("API избранных документов недоступно, используем заглушку");
            // Пока API не готово, можно использовать пустой массив
            setFavoriteDocuments([]);
          } else {
            throw err; // Пробрасываем другие ошибки
          }
        }
      } catch (err) {
        console.error("Ошибка при загрузке избранных документов:", err);
        setFavoriteDocuments([]); // В случае ошибки устанавливаем пустой массив
      }
    };

    fetchFavorites();
  }, [pathname]); // Обновляем при изменении пути

  // Поиск по документам
  useEffect(() => {
    if (!searchQuery.trim()) {
      setIsSearching(false)
      setSearchResults([])
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await api.get(`/documents/search/?q=${encodeURIComponent(searchQuery)}`)
        setSearchResults(response.data)
      } catch (err) {
        console.error("Ошибка при поиске:", err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [searchQuery])

  // Функция для перехода к корневому документу
  const navigateToRoot = async () => {
    try {
      const response = await api.get("/documents/?root=true");
      console.log("Ответ API при запросе корневого документа из сайдбара:", response.data);
      
      // Проверяем, что ответ содержит документ с id
      if (response.data && response.data.id) {
        router.push(`/documents/${response.data.id}`);
      } else if (Array.isArray(response.data) && response.data.length > 0 && response.data[0].id) {
        // Если API возвращает массив документов, берем первый
        router.push(`/documents/${response.data[0].id}`);
      } else {
        // Если документ не найден, перенаправляем на главную страницу,
        // где произойдет создание корневого документа
        router.push('/');
      }
    } catch (err) {
      console.error("Ошибка при загрузке корневого документа:", err);
      // Перенаправляем на главную страницу для создания документа
      router.push('/');
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Поиск..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="pt-0">
        {/* Результаты поиска */}
        {searchQuery && (
          <SidebarGroup className="mb-4">
            <SidebarGroupLabel>Результаты поиска</SidebarGroupLabel>
            <SidebarGroupContent>
              {isSearching ? (
                <div className="px-4 py-2 text-sm text-muted-foreground">
                  Поиск...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((doc) => (
                  <Link 
                    key={doc.id} 
                    href={`/documents/${doc.id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent/50",
                      pathname === `/documents/${doc.id}` && "bg-accent/50"
                    )}
                    onClick={() => setSearchQuery("")}
                  >
                    <File className="h-4 w-4" />
                    <span className="truncate">{doc.title || "Без названия"}</span>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-muted-foreground">
                  Ничего не найдено
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarMenu>
          <SidebarMenuButton onClick={navigateToRoot} className={pathname === "/" ? "bg-accent/50" : undefined}>
            <Home className="h-4 w-4" />
            <span>Главная</span>
          </SidebarMenuButton>
        </SidebarMenu>

        {/* Избранные документы */}
        {favoriteDocuments.length > 0 && (
          <SidebarGroup className="mb-4 mt-4">
            <SidebarGroupLabel>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-400" />
                <span>Избранное</span>
              </div>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {favoriteDocuments.map((doc) => (
                <Link 
                  key={doc.id} 
                  href={`/documents/${doc.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent/50",
                    pathname === `/documents/${doc.id}` && "bg-accent/50"
                  )}
                >
                  <File className="h-4 w-4" />
                  <span className="truncate">{doc.title || "Без названия"}</span>
                </Link>
              ))}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarMenu className="mt-auto">
          <SidebarMenuButton asChild>
            <Link href="/settings" className={pathname === "/settings" ? "bg-accent/50 w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium" : "w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"}>
              <Settings className="h-4 w-4" />
              <span>Настройки</span>
            </Link>
          </SidebarMenuButton>
          <SidebarMenuButton asChild>
            <Link href="/profile" className={pathname === "/profile" ? "bg-accent/50 w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium" : "w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"}>
              <User className="h-4 w-4" />
              <span>Профиль</span>
            </Link>
          </SidebarMenuButton>
          <SidebarMenuButton onClick={logout}>
            <LogOut className="h-4 w-4" />
            <span>Выйти</span>
          </SidebarMenuButton>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
} 