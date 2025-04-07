"use client"

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Users, FileText, CheckSquare, Activity, Award } from 'lucide-react';
import api from '@/lib/api';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface DocumentStatisticsProps {
  documentId: string;
}

interface Statistics {
  created_at: string;
  editor_count: number;
  nested_documents_count: number;
  tasks_count: number;
  completed_tasks_count: number;
  completion_percentage: number;
  most_active_user: string | null;
}

export function DocumentStatistics({ documentId }: DocumentStatisticsProps) {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        
        const response = await api.get(`/documents/${documentId}/statistics/`);
        
        setStatistics(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching document statistics:', err);
        setError('Не удалось загрузить статистику документа');
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      fetchStatistics();
    }
  }, [documentId]);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPP', { locale: ru });
    } catch (e) {
      return 'Недоступно';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Статистика документа</CardTitle>
          <CardDescription>Загрузка данных...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Статистика документа</CardTitle>
          <CardDescription>Произошла ошибка</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Статистика документа</CardTitle>
        <CardDescription>
          Создан {formatDate(statistics.created_at)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general">
          <TabsList className="mb-4">
            <TabsTrigger value="general">Общая</TabsTrigger>
            <TabsTrigger value="tasks">Задачи</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Редакторы</div>
                  <div className="text-2xl font-bold">{statistics.editor_count}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Вложенные документы</div>
                  <div className="text-2xl font-bold">{statistics.nested_documents_count}</div>
                </div>
              </div>
            </div>
            
            {statistics.most_active_user && (
              <div className="pt-2">
                <div className="flex items-center space-x-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  <div>
                    <div className="text-sm font-medium">Самый активный участник</div>
                    <div className="font-semibold">{statistics.most_active_user}</div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="tasks" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Всего задач</div>
                  <div className="text-2xl font-bold">{statistics.tasks_count}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <CheckSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Выполнено</div>
                  <div className="text-2xl font-bold">{statistics.completed_tasks_count}</div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm">
                <span>Прогресс выполнения</span>
                <span>{statistics.completion_percentage}%</span>
              </div>
              <Progress value={statistics.completion_percentage} className="h-2" />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 

