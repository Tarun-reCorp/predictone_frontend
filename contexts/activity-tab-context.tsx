"use client";

import { createContext, useContext, useState } from "react";

export type ActivityTab = "dashboard" | "orders" | "transactions";

interface ActivityTabCtx {
  activeTab: ActivityTab;
  setActiveTab: (t: ActivityTab) => void;
}

const ActivityTabContext = createContext<ActivityTabCtx>({
  activeTab: "dashboard",
  setActiveTab: () => {},
});

export function ActivityTabProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<ActivityTab>("dashboard");
  return (
    <ActivityTabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </ActivityTabContext.Provider>
  );
}

export function useActivityTab() {
  return useContext(ActivityTabContext);
}
