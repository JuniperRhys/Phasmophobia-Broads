import type { WSMessage } from "@shared/schema";

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Set<(message: WSMessage) => void> = new Set();
  private connectionHandlers: Set<(connected: boolean) => void> = new Set();

  connect() {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host || "localhost";
      const wsUrl = `${protocol}//${host}/ws`;
      
      if (!wsUrl || wsUrl.includes("undefined")) {
        console.error("Invalid WebSocket URL:", wsUrl);
        this.reconnect();
        return;
      }
      
      this.ws = new WebSocket(wsUrl);
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      this.reconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.notifyConnectionHandlers(true);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        this.messageHandlers.forEach((handler) => handler(message));
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
      this.notifyConnectionHandlers(false);
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  private reconnect() {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      console.log("Attempting to reconnect...");
      this.connect();
    }, 3000);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send<T extends WSMessage>(message: Omit<T, "timestamp">) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const fullMessage = {
        ...message,
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      console.warn("WebSocket not connected, cannot send message");
    }
  }

  onMessage(handler: (message: WSMessage) => void) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler: (connected: boolean) => void) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private notifyConnectionHandlers(connected: boolean) {
    this.connectionHandlers.forEach((handler) => handler(connected));
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WebSocketClient();
