import React, { createContext, useContext, useState, ReactNode } from "react";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, addDays, subWeeks } from "date-fns";

export type Period = "week" | "month";

interface FilterState {
  dateFrom: string;
  dateTo: string;
  period: Period;
  setDateRange: (from: string, to: string) => void;
  setPeriod: (period: Period) => void;
  applyPreset: (preset: "lastWeek" | "thisMonth" | "last30Days" | "custom") => void;
}

const FilterContext = createContext<FilterState | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  // Default to previous week's Monday to Friday
  const [dateFrom, setDateFrom] = useState(() => {
    const lastWeek = subWeeks(new Date(), 1);
    return format(startOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");
  });
  const [dateTo, setDateTo] = useState(() => {
    const lastWeek = subWeeks(new Date(), 1);
    return format(addDays(startOfWeek(lastWeek, { weekStartsOn: 1 }), 4), "yyyy-MM-dd");
  });
  const [period, setPeriod] = useState<Period>("week");

  const setDateRange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const applyPreset = (preset: "lastWeek" | "thisMonth" | "last30Days" | "custom") => {
    const today = new Date();
    if (preset === "lastWeek") {
      const lastWeek = subWeeks(today, 1);
      setDateFrom(format(startOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setDateTo(format(addDays(startOfWeek(lastWeek, { weekStartsOn: 1 }), 4), "yyyy-MM-dd"));
      setPeriod("week");
    } else if (preset === "thisMonth") {
      setDateFrom(format(startOfMonth(today), "yyyy-MM-dd"));
      setDateTo(format(endOfMonth(today), "yyyy-MM-dd"));
      setPeriod("month");
    } else if (preset === "last30Days") {
      setDateFrom(format(subDays(today, 30), "yyyy-MM-dd"));
      setDateTo(format(today, "yyyy-MM-dd"));
      setPeriod("month");
    }
  };

  return (
    <FilterContext.Provider value={{ dateFrom, dateTo, period, setDateRange, setPeriod, applyPreset }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
}
