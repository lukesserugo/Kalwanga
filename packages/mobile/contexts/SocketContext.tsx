import React, { createContext, ReactNode } from "react";
import { useSocket as useSocketHook } from "../hooks/useSocket";

interface SocketContextType {
  socket: any;
  isConnected: boolean;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { socket, isConnected } = useSocketHook();

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
