"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import api from "@/lib/api"

export function RegisterForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState<boolean>(false)
  const [registrationData, setRegistrationData] = useState<{
    email: string;
    otp: string;
    password: string;
  } | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const username = formData.get("username") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const passwordConfirm = formData.get("passwordConfirm") as string

    if (password !== passwordConfirm) {
      setError("Пароли не совпадают")
      setIsLoading(false)
      return
    }

    try {
      const response = await api.post("/register/", {
        username,
        email,
        password,
        password_confirm: passwordConfirm,
      })

      const data = response.data
      
      // Сохраняем данные для подтверждения email
      setRegistrationData({
        email: data.email,
        otp: data.otp, // В реальном приложении OTP будет отправлен на email
        password,
      })
      
      setOtpSent(true)
    } catch (error: any) {
      console.error("Ошибка регистрации:", error)
      
      // Более детальная обработка ошибок
      if (error.response?.data) {
        if (typeof error.response.data === 'object') {
          // Если сервер вернул объект с ошибками
          const errorMsg = Object.entries(error.response.data)
            .map(([field, errors]) => {
              if (Array.isArray(errors)) {
                return `${field}: ${errors.join(', ')}`;
              }
              return `${field}: ${errors}`;
            })
            .join('; ');
          setError(errorMsg);
        } else if (error.response.data.detail) {
          // Если есть поле detail
          setError(error.response.data.detail);
        } else {
          // Для других случаев
          setError('Произошла ошибка при регистрации');
        }
      } else {
        setError('Произошла ошибка при соединении с сервером');
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function onVerifySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!registrationData) return
    
    setIsLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const otp = formData.get("otp") as string

    try {
      // Верификация email
      await api.post("/verify-email/", {
        email: registrationData.email,
        otp,
      })

      // После успешной верификации - автоматический вход
      try {
        const loginResponse = await api.post("/token/", {
          email: registrationData.email,
          password: registrationData.password, // Нужно сохранить пароль при регистрации
        })

        // Сохраняем токены
        localStorage.setItem("accessToken", loginResponse.data.access)
        localStorage.setItem("refreshToken", loginResponse.data.refresh)
        
        // Перенаправляем на корневой документ
        router.push("/")
      } catch (loginError) {
        console.error("Не удалось автоматически войти:", loginError)
        // В случае ошибки автовхода, перенаправляем на страницу входа
        router.push("/login")
      }
    } catch (error: any) {
      console.error("Ошибка подтверждения email:", error)
      setError(error.response?.data?.detail || "Неверный код подтверждения")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {otpSent ? "Подтверждение Email" : "Регистрация"}
          </CardTitle>
          <CardDescription>
            {otpSent
              ? "Введите код подтверждения, отправленный на ваш email"
              : "Создайте новый аккаунт"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {otpSent ? (
            <form onSubmit={onVerifySubmit}>
              <div className="flex flex-col gap-6">
                {error && (
                  <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="otp">Код подтверждения</Label>
                  <Input
                    id="otp"
                    name="otp"
                    type="text"
                    placeholder="123456"
                    required
                    disabled={isLoading}
                  />
                  {/* В демо-режиме показываем OTP */}
                  {registrationData && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Демо-режим: Ваш код {registrationData.otp}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Подтверждение..." : "Подтвердить Email"}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={onSubmit}>
              <div className="flex flex-col gap-6">
                {error && (
                  <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="username">Имя пользователя</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="passwordConfirm">Подтверждение пароля</Label>
                  <Input
                    id="passwordConfirm"
                    name="passwordConfirm"
                    type="password"
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Регистрация..." : "Зарегистрироваться"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Уже есть аккаунт?{" "}
                <Link href="/login" className="underline underline-offset-4">
                  Войти
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 