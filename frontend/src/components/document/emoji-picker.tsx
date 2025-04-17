"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

// Импортируем EmojiPicker динамически, т.к. он не работает на сервере
const DynamicEmojiPicker = dynamic(
  () => import("emoji-picker-react").then((mod) => mod.default),
  { ssr: false }
);

interface EmojiPickerProps {
  currentEmoji?: string;
  onEmojiSelect: (emoji: string) => void;
  defaultIcon?: React.ReactNode;
}

export function EmojiPicker({ 
  currentEmoji, 
  onEmojiSelect, 
  defaultIcon 
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiClick = (emojiData: any) => {
    onEmojiSelect(emojiData.emoji);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-16 w-16 p-0 rounded-full"
          aria-label="Выбрать эмодзи"
        >
          {currentEmoji ? (
            <span className="text-4xl">{currentEmoji}</span>
          ) : (
            defaultIcon || (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            )
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 border-none shadow-lg">
        <DynamicEmojiPicker
          onEmojiClick={handleEmojiClick}
          lazyLoadEmojis={true}
          searchPlaceHolder="Поиск эмодзи..."
          width="100%"
        />
      </PopoverContent>
    </Popover>
  );
} 