import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, ArrowRight } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerWithRange({
  className,
  value,
  onChange,
}: {
  className?: string
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}) {
  const [fromOpen, setFromOpen] = React.useState(false)
  const [toOpen, setToOpen] = React.useState(false)

  // Local display state — tracks in-progress picks before full range is committed
  const [localFrom, setLocalFrom] = React.useState<Date | undefined>(value?.from)
  const [localTo, setLocalTo] = React.useState<Date | undefined>(value?.to)

  // Sync from parent when value changes externally (e.g. preset buttons)
  React.useEffect(() => {
    setLocalFrom(value?.from)
    setLocalTo(value?.to)
  }, [value?.from?.toISOString(), value?.to?.toISOString()])

  const handleFromSelect = (date: Date | undefined) => {
    if (!date) return
    setLocalFrom(date)

    // If To already exists and is valid, apply the full range immediately
    if (localTo && date <= localTo) {
      onChange({ from: date, to: localTo })
      setFromOpen(false)
    } else {
      // Clear To so user picks a fresh end date
      setLocalTo(undefined)
      setFromOpen(false)
      // Auto-open the To picker after a short delay
      setTimeout(() => setToOpen(true), 120)
    }
  }

  const handleToSelect = (date: Date | undefined) => {
    if (!date) return
    const from = localFrom ?? date
    // Swap if user picks end before start
    const finalFrom = date < from ? date : from
    const finalTo = date < from ? from : date
    setLocalFrom(finalFrom)
    setLocalTo(finalTo)
    onChange({ from: finalFrom, to: finalTo })
    setToOpen(false)
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* FROM */}
      <Popover open={fromOpen} onOpenChange={setFromOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-8 px-3 justify-start text-left font-normal text-xs gap-2 min-w-[136px]",
              !localFrom && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              <span className="text-muted-foreground mr-1">From</span>
              {localFrom ? format(localFrom, "dd MMM yyyy") : "Pick date"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="px-4 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border/40 mb-1">
            Select Start Date
          </div>
          <Calendar
            initialFocus
            mode="single"
            selected={localFrom}
            onSelect={handleFromSelect}
            defaultMonth={localFrom}
            className="[--cell-size:2.75rem] p-4"
            classNames={{
              today: "text-foreground font-semibold",
              weekday: "text-muted-foreground text-sm font-medium w-[2.75rem] text-center",
              month_caption: "flex h-[2.75rem] w-full items-center justify-center px-[2.75rem] text-base font-semibold",
              day: "group/day relative aspect-square h-full w-full select-none p-0 text-center text-sm",
              week: "mt-1 flex w-full",
            }}
          />
        </PopoverContent>
      </Popover>

      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

      {/* TO */}
      <Popover open={toOpen} onOpenChange={setToOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-8 px-3 justify-start text-left font-normal text-xs gap-2 min-w-[136px]",
              !localTo && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              <span className="text-muted-foreground mr-1">To</span>
              {localTo ? format(localTo, "dd MMM yyyy") : "Pick date"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="px-4 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border/40 mb-1">
            Select End Date
          </div>
          <Calendar
            initialFocus
            mode="single"
            selected={localTo}
            onSelect={handleToSelect}
            defaultMonth={localTo ?? localFrom}
            fromDate={localFrom}
            className="[--cell-size:2.75rem] p-4"
            classNames={{
              today: "text-foreground font-semibold",
              weekday: "text-muted-foreground text-sm font-medium w-[2.75rem] text-center",
              month_caption: "flex h-[2.75rem] w-full items-center justify-center px-[2.75rem] text-base font-semibold",
              day: "group/day relative aspect-square h-full w-full select-none p-0 text-center text-sm",
              week: "mt-1 flex w-full",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
