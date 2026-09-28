import { io, Socket } from "socket.io-client";

// Connect through the Vite proxy (/socket.io → http://localhost:5000)
// so it works in both dev and Replit preview without hardcoding the port.
let socket: Socket | null = null;

/** Run `fn` once the browser is idle, with a hard fallback timer so the
 *  connection is never starved on always-busy pages. */
function whenIdle(fn: () => void, fallbackMs = 1500): void {
  const win = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === "function") {
    win.requestIdleCallback(fn, { timeout: fallbackMs * 2 });
  } else {
    setTimeout(fn, fallbackMs);
  }
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io("/", {
      path: "/socket.io",
      // Replit's proxied iframe returns 400 on the WebSocket upgrade handshake.
      // Locking to polling keeps the connection stable; events are still
      // delivered in real-time with negligible latency for a store's needs.
      transports: ["polling"],
      upgrade: false,
      withCredentials: true,
      // Create the socket immediately so listeners attach as before, but defer
      // the wire handshake until the browser is idle — the route chunks, LCP
      // image and first paint get the network budget first. Realtime delivery
      // is unchanged beyond the first idle beat (reconnection, event replay
      // and the order-status "visit" path all behave exactly as before).
      autoConnect: false,
      // When the API backend restarts (nodemon on save, crash recovery) the
      // proxy briefly returns ECONNREFUSED. Back off slowly instead of retrying
      // every second so the Vite dev terminal doesn't fill with proxy-error
      // spam while the backend comes back up.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 20000,
      randomizationFactor: 0.3,
    });
    whenIdle(() => {
      if (!socket?.connected) socket?.connect();
    });
  }
  return socket;
}