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
        console.log("Загрузка избранных документов...");
        
        // Получаем список избранных документов
        const response = await api.get("/documents/favorites/");
        console.log("Ответ API избранных документов:", response.data);
        
        if (Array.isArray(response.data)) {
          setFavoriteDocuments(response.data);
          console.log(`Загружено ${response.data.length} избранных документов`);
        } else {
          console.warn("Неожиданный формат данных от API избранных:", response.data);
          setFavoriteDocuments([]);
        }
      } catch (err) {
        console.error("Ошибка при загрузке избранных документов:", err);
        setFavoriteDocuments([]);
      }
    };

    // Загружаем избранные только если пользователь авторизован
    if (user) {
      fetchFavorites();
    }
  }, [user, pathname]); // Обновляем при изменении пользователя или пути
  
  // Обработка обновлений избранных документов в реальном времени
  useEffect(() => {
    const handleFavoriteUpdated = (event: StorageEvent) => {
      if (event.key === 'favorite_document_updated' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          console.log('Обновление избранных документов:', data);
          
          if (data.isFavorite) {
            // Добавляем документ в избранное (если его еще нет)
            setFavoriteDocuments(prev => {
              // Проверяем, нет ли уже этого документа в списке
              const exists = prev.some(doc => doc.id === data.documentId);
              if (exists) return prev;
              
              // Добавляем новый документ в список избранных
              return [...prev, { id: data.documentId, title: data.title }];
            });
          } else {
            // Удаляем документ из избранного
            setFavoriteDocuments(prev => 
              prev.filter(doc => doc.id !== data.documentId)
            );
          }
        } catch (err) {
          console.error('Ошибка при обработке обновления избранных:', err);
        }
      }
    };
    
    // Добавляем обработчик события storage
    window.addEventListener('storage', handleFavoriteUpdated);
    
    return () => {
      // Удаляем обработчик при размонтировании компонента
      window.removeEventListener('storage', handleFavoriteUpdated);
    };
  }, []);

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
      console.log("Запрос корневого документа из сайдбара...");
      
      // Получаем список всех корневых документов пользователя
      const response = await api.get("/documents/?root=true");
      console.log("Ответ API при запросе корневого документа из сайдбара:", response.data);
      
      // Определяем ID корневого документа согласно установленным правилам
      let rootDocumentId = null;
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        console.log(`Обнаружено ${response.data.length} корневых документов, выбираем основной`);
        
        // Строгое правило: всегда выбираем документ с наименьшим ID (самый первый созданный)
        const sortedDocs = [...response.data].sort((a, b) => {
          const idA = parseInt(a.id);
          const idB = parseInt(b.id);
          return idA - idB;  // От меньшего к большему - выбираем самый старый
        });
        
        const oldestDoc = sortedDocs[0];
        rootDocumentId = oldestDoc.id;
        console.log(`Выбран документ с ID ${rootDocumentId} как самый первый корневой документ`);
      } else if (response.data && response.data.id) {
        // Если получили один объект документа
        rootDocumentId = response.data.id;
        console.log(`Выбран единственный корневой документ с ID ${rootDocumentId}`);
      }
      
      // Если нашли корневой документ, перенаправляем на него
      if (rootDocumentId) {
        if (pathname !== `/documents/${rootDocumentId}`) {
          console.log(`Переход к корневому документу с ID ${rootDocumentId}`);
          router.push(`/documents/${rootDocumentId}`);
        } else {
          console.log("Уже находимся на странице корневого документа");
        }
      } else {
        // Если корневых документов нет, перенаправляем на главную
        console.log("Корневой документ не найден, перенаправление на главную");
        router.push('/');
      }
    } catch (err) {
      console.error("Ошибка при загрузке корневого документа:", err);
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
              <Star className="mr-2 h-4 w-4" />
              Избранное
            </h2>
            <div className="space-y-1">
              {favoriteDocuments.map((doc) => (
                <Link 
                  key={doc.id} 
                  href={`/documents/${doc.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent/50 ml-6",
                    pathname === `/documents/${doc.id}` && "bg-accent/50"
                  )}
                >
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