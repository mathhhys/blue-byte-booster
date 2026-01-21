import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  className?: string
  onChange?: (range: { start: string; end: string }) => void
}

export function DateRangePicker({
  className,
  onChange,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  })

  React.useEffect(() => {
    if (date?.from && date?.to && onChange) {
      onChange({
        start: date.from.toISOString(),
        end: date.to.toISOString(),
      })
    }
  }, [date, onChange])

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal border-white/10 bg-[#1a1a1a] text-white hover:bg-white/10 hover:text-white",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-[#1a1a1a] border-white/10" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            className="bg-[#1a1a1a] text-white"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}