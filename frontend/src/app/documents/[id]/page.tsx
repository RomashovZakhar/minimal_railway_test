"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AppSidebar } from "@/components/layout"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { DocumentEditor } from "@/components/document-editor"
import api from "@/lib/api"
import { 
  Star, 
  Share, 
  MoreHorizontal,
  ChevronRight,
  BarChart3,
  Trash,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

// Тип для документа
interface Document {
  id: string;
  title: string;
  content: any;
  parent: string | null;
  path?: Array<{ id: string; title: string }>;
  is_favorite?: boolean;
}

export default function DocumentPage() {
  const { id } = useParams() as { id: string }
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocument = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/documents/${id}/`)
      setDocument(response.data)
      setError(null)
    } catch (err) {
      console.error("Ошибка при загрузке документа:", err)
      setError("Не удалось загрузить документ")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocument()
  }, [id])

  const handleDocumentChange = (updatedDoc: Document) => {
    setDocument(updatedDoc)
  }

  const toggleFavorite = async () => {
    if (!document) return

    try {
      // Оптимистичное обновление UI
      setDocument({ ...document, is_favorite: !document.is_favorite })

      // API запрос на изменение статуса избранного
      await api.post(`/documents/${document.id}/favorite/`, {
        is_favorite: !document.is_favorite
      })

      toast(document.is_favorite ? "Удалено из избранного" : "Добавлено в избранное")
    } catch (err) {
      // Если ошибка - возвращаем исходное состояние
      setDocument({ ...document, is_favorite: document.is_favorite })
      toast.error("Не удалось изменить статус избранного")
    }
  }

  const shareDocument = () => {
    // Копируем ссылку на документ в буфер обмена
    navigator.clipboard.writeText(window.location.href)
    toast("Ссылка скопирована", {
      description: "Теперь вы можете поделиться документом"
    })
  }

  const deleteDocument = async () => {
    if (!document || !window.confirm("Вы уверены, что хотите удалить этот документ?")) return

    try {
      await api.delete(`/documents/${document.id}/`)
      // Редирект на родительский документ или корневой документ
      if (document.parent) {
        window.location.href = `/documents/${document.parent}`
      } else {
        window.location.href = `/documents`
      }
    } catch (err) {
      toast.error("Не удалось удалить документ")
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Загрузка...</div>
  }

  if (error || !document) {
    return <div className="flex items-center justify-center h-screen text-red-500">{error}</div>
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Хедер с хлебными крошками и кнопками */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          
          {/* Хлебные крошки с иерархией документа */}
          <Breadcrumb className="flex-1">
            <BreadcrumbList>
              {document.path && document.path.map((item, index) => (
                <React.Fragment key={item.id}>
                  <BreadcrumbItem>
                    <BreadcrumbLink href={`/documents/${item.id}`}>
                      {item.title || "Без названия"}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                </React.Fragment>
              ))}
              <BreadcrumbItem>
                <BreadcrumbLink href={`/documents/${document.id}`} className="font-semibold">
                  {document.title || "Без названия"}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          
          {/* Кнопки действий */}
          <div className="flex items-center gap-2">
            {/* Избранное */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleFavorite}
              className={document.is_favorite ? "text-yellow-400" : ""}
            >
              <Star className="h-5 w-5" />
            </Button>
            
            {/* Поделиться */}
            <Button variant="ghost" size="icon" onClick={shareDocument}>
              <Share className="h-5 w-5" />
            </Button>
            
            {/* Дополнительные действия */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => window.open(`/documents/${document.id}/stats`, "_blank")}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Статистика
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={deleteDocument}
                  className="text-red-500 focus:text-red-500"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        {/* Редактор документа */}
        <div className="flex-1 p-4 overflow-auto">
          <DocumentEditor document={document} onChange={handleDocumentChange} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 