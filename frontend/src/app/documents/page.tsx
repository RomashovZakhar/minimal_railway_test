"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"

// Шаблон приветственного контента для нового пользователя
const welcomeContent = {
  blocks: [
    {
      type: "header",
      data: {
        text: "Добро пожаловать в ваше рабочее пространство!",
        level: 2
      }
    },
    {
      type: "paragraph",
      data: {
        text: "Это ваш первый документ. Здесь вы можете организовать свои мысли, задачи и проекты."
      }
    },
    {
      type: "header",
      data: {
        text: "Как начать работу",
        level: 3
      }
    },
    {
      type: "list",
      data: {
        style: "unordered",
        items: [
          "Нажмите / для вызова меню команд",
          "Создавайте заголовки, списки и чек-листы",
          "Добавляйте вложенные документы для организации информации",
          "Используйте звездочку в верхнем меню, чтобы добавить документ в избранное"
        ]
      }
    },
    {
      type: "header",
      data: {
        text: "Ваши первые задачи",
        level: 3
      }
    },
    {
      type: "checklist",
      data: {
        items: [
          {
            text: "Изучить интерфейс",
            checked: false
          },
          {
            text: "Создать свой первый вложенный документ",
            checked: false
          },
          {
            text: "Добавить документ в избранное",
            checked: false
          },
          {
            text: "Поделиться документом с коллегой",
            checked: false
          }
        ]
      }
    },
    {
      type: "paragraph",
      data: {
        text: "Удачи в работе с вашими документами! Если у вас возникнут вопросы, обратитесь к документации или в службу поддержки."
      }
    }
  ]
};

export default function DocumentsIndexPage() {
  const router = useRouter()

  useEffect(() => {
    // Проверяем, авторизован ли пользователь
    const token = localStorage.getItem("accessToken")
    
    if (!token) {
      // Если не авторизован, перенаправляем на страницу входа
      router.push("/login")
      return
    }
    
    // Если авторизован, загружаем корневой документ
    const fetchRootDocument = async () => {
      try {
        // Получаем корневой документ
        const response = await api.get("/documents/?root=true")
        console.log("Ответ API при запросе корневого документа:", response.data)
        
        // Проверяем, что ответ содержит документ с id
        if (response.data && response.data.id) {
          const rootDocumentId = response.data.id
          // Перенаправляем на страницу документа
          router.push(`/documents/${rootDocumentId}`)
        } else if (Array.isArray(response.data) && response.data.length > 0 && response.data[0].id) {
          // Если API возвращает массив документов, берем первый
          const rootDocumentId = response.data[0].id
          router.push(`/documents/${rootDocumentId}`)
        } else {
          // Если документ не найден или формат ответа неожиданный, создаем новый
          throw new Error("Корневой документ не найден или неверный формат ответа")
        }
      } catch (err) {
        console.error("Ошибка при загрузке корневого документа:", err)
        // Если корневого документа нет, создаем его с приветственным контентом
        try {
          console.log("Создаю новый корневой документ");
          const newRootResponse = await api.post("/documents/", {
            title: "Моё рабочее пространство",
            parent: null,
            is_root: true,
            content: welcomeContent
          });
          
          console.log("Ответ API при создании корневого документа:", newRootResponse.data);
          
          // Проверяем, что ответ содержит id нового документа
          if (newRootResponse.data && newRootResponse.data.id) {
            router.push(`/documents/${newRootResponse.data.id}`);
          } else {
            console.error("Не удалось получить ID созданного документа:", newRootResponse.data);
            // Если не удалось получить ID, показываем сообщение об ошибке
            alert("Не удалось создать корневой документ. Пожалуйста, обновите страницу или обратитесь в службу поддержки.");
          }
        } catch (createErr) {
          console.error("Ошибка при создании корневого документа:", createErr);
          // Показываем сообщение об ошибке пользователю
          alert("Произошла ошибка при создании корневого документа. Пожалуйста, попробуйте еще раз.");
        }
      }
    }

    fetchRootDocument()
  }, [router])

  // Показываем индикатор загрузки, пока идет перенаправление
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
      <p className="text-lg text-muted-foreground">Загрузка документа...</p>
    </div>
  )
} 