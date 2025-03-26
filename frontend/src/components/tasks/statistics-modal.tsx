import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { BarChart, Clock, FileText, Users, Award, AlertTriangle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TaskStatistics {
  createdAt: string;  // Дата создания задачи
  editorCount: number;  // Количество редакторов
  totalDocuments: number;  // Общее количество документов
  totalTasks: number;  // Общее количество задач
  completedTasks: number;  // Количество выполненных задач
  overdueCount: number;  // Количество просроченных задач
  topContributor?: string;  // Имя самого активного участника
}

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  statistics: TaskStatistics;
}

export function StatisticsModal({
  isOpen,
  onClose,
  statistics
}: StatisticsModalProps) {
  // Функция для форматирования времени создания
  const formatCreationTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { locale: ru, addSuffix: true });
    } catch (e) {
      return 'Неизвестно';
    }
  };

  // Функция для вычисления прогресса задач
  const calculateProgress = () => {
    if (statistics.totalTasks === 0) return 0;
    return Math.round((statistics.completedTasks / statistics.totalTasks) * 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Статистика документа
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Время создания */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Создан:</span>
            </div>
            <div className="font-medium">
              {formatCreationTime(statistics.createdAt)}
            </div>
          </div>

          {/* Количество редакторов */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Редакторы:</span>
            </div>
            <div className="font-medium">
              {statistics.editorCount} {statistics.editorCount === 1 ? 'участник' : 
                (statistics.editorCount > 1 && statistics.editorCount < 5) ? 'участника' : 'участников'}
            </div>
          </div>

          {/* Количество документов */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Всего документов:</span>
            </div>
            <div className="font-medium">
              {statistics.totalDocuments}
            </div>
          </div>

          {/* Прогресс задач */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Выполнение задач:</span>
              </div>
              <div className="font-medium">
                {statistics.completedTasks} из {statistics.totalTasks} ({calculateProgress()}%)
              </div>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full" 
                style={{ width: `${calculateProgress()}%` }}
              />
            </div>
          </div>

          {/* Просроченные задачи */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Просрочено задач:</span>
            </div>
            <div className="font-medium text-destructive">
              {statistics.overdueCount}
            </div>
          </div>

          {/* Самый активный участник */}
          {statistics.topContributor && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Award className="h-4 w-4" />
                <span>Самый активный:</span>
              </div>
              <div className="font-medium">
                {statistics.topContributor}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 