"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { makeQueryClient, registerQueryClient } from "@/lib/queryClient";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState (not useMemo/module scope) so the client is created exactly
  // once per component instance and survives re-renders, but a fresh mount
  // (e.g. a full page reload) always starts from an empty cache.
  const [queryClient] = useState(() => {
    const client = makeQueryClient();
    registerQueryClient(client);
    return client;
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
