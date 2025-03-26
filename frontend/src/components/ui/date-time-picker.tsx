import * as React from "react"
import { format, setHours, setMinutes } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateTimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function DateTimePicker({ 
  date, 
  setDate, 
  placeholder = "Выберите дату и время", 
  className 
}: DateTimePickerProps) {
  
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5).map(
    (minute) => ({
      value: minute,
      label: minute.toString().padStart(2, "0"),
    })
  )

  const hourOptions = Array.from({ length: 24 }, (_, i) => i).map((hour) => ({
    value: hour,
    label: hour.toString().padStart(2, "0"),
  }))

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!date) return

    const newHour = parseInt(e.target.value, 10)
    setDate(setHours(date, newHour))
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!date) return
    
    const newMinute = parseInt(e.target.value, 10)
    setDate(setMinutes(date, newMinute))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? (
              format(date, "PPP HH:mm")
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
        />
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Время:</span>
            </div>
            <div className="flex items-center space-x-2">
              <select
                className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
                value={date ? date.getHours() : ""}
                onChange={handleHourChange}
                disabled={!date}
              >
                {!date && <option value="">--</option>}
                {hourOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span>:</span>
              <select
                className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
                value={date ? Math.floor(date.getMinutes() / 5) * 5 : ""}
                onChange={handleMinuteChange}
                disabled={!date}
              >
                {!date && <option value="">--</option>}
                {minuteOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 