"use client";

import { createContext, useContext } from "react";

export const DemoContext = createContext(false);
export const useDemoMode = () => useContext(DemoContext);
