"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { Button } from "@/components/ui/button"

// Тип для документа в избранном
interface FavoriteDocument {
  id: string;
  title: string;
}

interface AppSidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function AppSidebar({ className, ...props }: AppSidebarProps) {
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
    <div className={cn("border-r bg-background flex flex-col h-full", className)} {...props}>
      {/* Поиск */}
      <div className="p-4 border-b">
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
      
      <ScrollArea className="flex-1 px-2">
        {/* Результаты поиска */}
        {searchQuery && (
          <div className="py-2">
            <h2 className="px-2 py-1.5 text-sm font-semibold">Результаты поиска</h2>
            {isSearching ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Поиск...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((doc) => (
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
                ))}
              </div>
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Ничего не найдено
              </div>
            )}
          </div>
        )}

        {/* Главная / Рабочее пространство */}
        <div className="py-2">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start font-normal",
              pathname === "/" && "bg-accent/50"
            )}
            onClick={navigateToRoot}
          >
            <Home className="mr-2 h-4 w-4" />
            Рабочее пространство
          </Button>
        </div>

        {/* Избранные документы */}
        {favoriteDocuments.length > 0 && (
          <div className="py-2">
            <h2 className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold">
              <Star className="h-4 w-4 text-yellow-400" />
              Избранное
            </h2>
            <div className="space-y-1">
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
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Нижняя часть с настройками и выходом */}
      <div className="p-2 border-t mt-auto">
        <Button 
          variant="ghost" 
          className="w-full justify-start px-2 py-1.5"
          asChild
        >
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Настройки</span>
          </Link>
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start px-2 py-1.5"
          asChild
        >
          <Link href="/profile">
            <User className="mr-2 h-4 w-4" />
            <span>Профиль</span>
          </Link>
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start px-2 py-1.5"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Выйти</span>
        </Button>
      </div>
    </div>
  )
} 