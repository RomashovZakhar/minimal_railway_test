"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { toast } from "sonner";

interface ShareDocumentProps {
  documentId: string;
}

export function ShareDocument({ documentId }: ShareDocumentProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [includeChildren, setIncludeChildren] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleShare = async () => {
    if (!email.trim()) {
      toast.error("Введите email пользователя");
      return;
    }

    setIsLoading(true);

    try {
      // Сначала проверяем, существует ли пользователь с таким email
      console.log("Проверяем email:", email);
      const checkUserResponse = await api.get(`/users/check_email/?email=${encodeURIComponent(email)}`);
      console.log("Ответ от check_email:", checkUserResponse.data);
      
      // Убедимся, что пользователь найден
      if (!checkUserResponse.data.exists || !checkUserResponse.data.user_id) {
        toast.error("Пользователь с таким email не найден");
        setIsLoading(false);
        return;
      }
      
      const userId = checkUserResponse.data.user_id;
      
      // Формируем данные для запроса
      const shareData = {
        user: userId, // Отправляем в формате, ожидаемом бэкендом (число)
        document: documentId, // Добавляем ID документа в запрос
        role, // "editor" или "viewer"
        include_children: includeChildren // boolean
      };
      
      console.log("Отправляем запрос на предоставление доступа:", {
        url: `/documents/${documentId}/share/`,
        data: shareData
      });

      // Предоставляем доступ к документу
      const response = await api.post(`/documents/${documentId}/share/`, shareData);
      console.log("Ответ сервера:", response.data);

      toast.success("Приглашение отправлено");
      setEmail("");
      setOpen(false);
    } catch (error: any) {
      console.error("Ошибка при предоставлении доступа:", error);
      
      // Подробное логирование ошибки
      if (error.response) {
        console.error("Статус ошибки:", error.response.status);
        console.error("Данные ошибки:", error.response.data);
        
        // Различные типы ошибок
        if (error.response.data.user) {
          toast.error(`Ошибка: ${error.response.data.user}`);
        } else if (error.response.data.detail) {
          toast.error(error.response.data.detail);
        } else if (typeof error.response.data === 'object') {
          // Общий случай - собираем все сообщения об ошибках
          const errorMessages = Object.entries(error.response.data)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");
          toast.error(`Ошибка: ${errorMessages}`);
        } else {
          toast.error("Не удалось предоставить доступ к документу");
        }
      } else {
        toast.error("Ошибка соединения с сервером");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Share2 className="h-4 w-4" />
          <span>Поделиться</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Настройки доступа</h4>
            <p className="text-sm text-muted-foreground">
              Настройте параметры доступа для пользователя
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="email">Email пользователя</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="role">Роль</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Выберите роль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Наблюдатель</SelectItem>
                <SelectItem value="editor">Редактор</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="child-docs">Вложенные документы</Label>
              <p className="text-xs text-muted-foreground">
                Предоставить доступ ко всем вложенным документам
              </p>
            </div>
            <Switch
              id="child-docs"
              checked={includeChildren}
              onCheckedChange={setIncludeChildren}
            />
          </div>
          
          <Button 
            className="w-full" 
            onClick={handleShare} 
            disabled={isLoading || !email.trim()}
          >
            {isLoading ? "Отправка..." : "Отправить приглашение"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
} 