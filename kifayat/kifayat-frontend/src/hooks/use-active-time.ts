import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-store";

const HEARTBEAT_INTERVAL = 5 * 60 * 1000;

export function useActiveTime() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || typeof document === "undefined") return;

    const sendHeartbeat = () => {
      fetch("/api/auth/heartbeat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    };

    const stopHeartbeat = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const startHeartbeat = () => {
      if (intervalRef.current || document.visibilityState !== "visible") return;
      sendHeartbeat();
      intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    };

    handleVisibilityChange();
    window.addEventListener("focus", startHeartbeat);
    window.addEventListener("blur", stopHeartbeat);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopHeartbeat();
      window.removeEventListener("focus", startHeartbeat);
      window.removeEventListener("blur", stopHeartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);
}
