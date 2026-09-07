import { useEffect, useState } from "react";
import io, { Socket } from "socket.io-client";
import { useAuthContext } from "./useAuth";
import { getWebSocketUrl } from "../utils/helpers";

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isSignedIn, getToken } = useAuthContext();

  useEffect(() => {
    if (!isSignedIn) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const initSocket = async () => {
      try {
        const token = await getToken();
        const socketInstance = io(getWebSocketUrl(), {
          transports: ["websocket"],
          auth: { token },
          autoConnect: true,
        });

        socketInstance.on("connect", () => {
          setIsConnected(true);
          console.log("Socket connected");
        });

        socketInstance.on("disconnect", () => {
          setIsConnected(false);
          console.log("Socket disconnected");
        });

        socketInstance.on("connect_error", (error) => {
          console.error("Socket connection error:", error);
          setIsConnected(false);
        });

        setSocket(socketInstance);
      } catch (error) {
        console.error("Failed to initialize socket:", error);
      }
    };

    initSocket();

    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [isSignedIn]);

  return { socket, isConnected };
}
