import { createContext, useContext } from "react";

export const BoothContext = createContext(null);

export function useBooth() {
  const ctx = useContext(BoothContext);
  if (!ctx) throw new Error("useBooth harus dipakai di dalam <BoothProvider>");
  return ctx;
}
