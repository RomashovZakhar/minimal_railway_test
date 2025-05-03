import React, { useEffect, useRef } from 'react';
import './remote-cursor.css';

interface CursorPosition {
  x: number;
  y: number;
}

interface RemoteCursor {
  id: string;
  username: string;
  position: CursorPosition | null;
  color: string;
  timestamp?: number;
}

interface CursorOverlayProps {
  cursors: RemoteCursor[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Компонент для отображения курсоров других пользователей в стиле Figma
 */
const CursorOverlay: React.FC<CursorOverlayProps> = ({ cursors, containerRef }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Синхронизируем размеры оверлея с контейнером редактора
  useEffect(() => {
    const resizeOverlay = () => {
      if (!containerRef.current || !overlayRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      overlayRef.current.style.width = `${containerRect.width}px`;
      overlayRef.current.style.height = `${containerRect.height}px`;
    };

    // Начальная синхронизация
    resizeOverlay();
    
    // Добавляем обработчик события изменения размера окна
    window.addEventListener('resize', resizeOverlay);
    
    // Регулярная проверка размеров (для случаев изменения контента)
    const interval = setInterval(resizeOverlay, 1000);
    
    return () => {
      window.removeEventListener('resize', resizeOverlay);
      clearInterval(interval);
    };
  }, [containerRef]);

  return (
    <div 
      ref={overlayRef}
      className="cursor-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'visible'
      }}
    >
      {cursors.map(cursor => 
        cursor.position && (
          <div
            key={cursor.id}
            className="remote-cursor"
            style={{
              left: `${cursor.position.x}px`,
              top: `${cursor.position.y}px`,
              '--cursor-color': cursor.color
            } as React.CSSProperties}
          >
            <div 
              className="cursor-username"
              style={{
                '--cursor-color': cursor.color
              } as React.CSSProperties}
            >
              {cursor.username}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default CursorOverlay; 