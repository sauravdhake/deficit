import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useFilters } from "@/contexts/FilterContext";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";

export function DateRangeFilter() {
  const { dateFrom, dateTo, setDateRange } = useFilters();

  const value: DateRange | undefined = {
    from: dateFrom ? new Date(dateFrom) : undefined,
    to: dateTo ? new Date(dateTo) : undefined,
  };

  const handleChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd"));
    }
  };

  return <DatePickerWithRange value={value} onChange={handleChange} />;
}
