"use client";
import { useEffect, useState } from "react";
import { useUIStore } from "@/store/uiStore";

export function useCompactSidebar() {
  const saved = useUIStore((s) => s.sidebarCollapsed);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return saved || narrow;
}
