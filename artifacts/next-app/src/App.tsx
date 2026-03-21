"use client";

import { createContext, useContext } from "react";

// Demo mode context — exported so all components can import from "@/App"
export const DemoContext = createContext(false);
export const useDemoMode = () => useContext(DemoContext);
