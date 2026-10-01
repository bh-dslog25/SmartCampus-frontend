/**
 * frontend/src/services/websocket.ts
 * ---------------------------------
 * Realtime WebSocket manager cho SmartCampus Digital Twin.
 * Kết nối tới /ws/campus?token=... của AI Service.
 */
import { getToken } from "./api";

export type WebSocketMessageHandler = (message: any) => void;

class CampusWebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Set<WebSocketMessageHandler> = new Set();
  private reconnectTimer: any = null;
  private isConnected = false;

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = getToken() || "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/campus?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log("⚡ [WebSocket] Đã kết nối thành công tới SmartCampus Realtime Tunnel");
        this.emit({ type: "connection_status", connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data);
        } catch (e) {
          console.warn("Lỗi parse WS message:", event.data);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.warn("⚠️ [WebSocket] Kết nối bị ngắt, đang thử kết nối lại sau 3s...");
        this.emit({ type: "connection_status", connected: false });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error("❌ [WebSocket] Lỗi kết nối:", err);
      };
    } catch (err) {
      console.error("Không thể khởi tạo WebSocket:", err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  public subscribe(handler: WebSocketMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public send(data: Record<string, any>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket chưa sẵn sàng để gửi:", data);
    }
  }

  private emit(message: any): void {
    for (const handler of this.handlers) {
      try {
        handler(message);
      } catch (err) {
        console.error("Lỗi trong WebSocket event handler:", err);
      }
    }
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}

export const campusWs = new CampusWebSocketClient();
