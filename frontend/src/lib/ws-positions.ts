/**
 * WebSocket client for real-time truck position updates
 */

export interface TruckPosition {
  id: number;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  progress_pct: number;
  eta_next_waypoint_iso?: string;
}

interface PositionsMessage {
  type: 'positions';
  ts: string;
  trucks: TruckPosition[];
}

type MessageCallback = (message: PositionsMessage) => void;

class PositionsWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageCallbacks: Set<MessageCallback> = new Set();
  private currentBbox: number[] | null = null;
  private currentZoom: number | null = null;

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/positions`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          
          // Re-subscribe with current bbox if we had one
          if (this.currentBbox && this.currentZoom !== null) {
            this.subscribe(this.currentBbox, this.currentZoom);
          }
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as PositionsMessage;
            this.messageCallbacks.forEach(callback => callback(message));
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.ws = null;
          this.scheduleReconnect();
        };
      } catch (err) {
        console.error('Error connecting WebSocket:', err);
        this.scheduleReconnect();
        reject(err);
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  subscribe(bbox: number[], zoom: number) {
    this.currentBbox = bbox;
    this.currentZoom = zoom;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        bbox,
        zoom
      }));
    }
  }

  unsubscribe() {
    this.currentBbox = null;
    this.currentZoom = null;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe'
      }));
    }
  }

  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => {
      this.messageCallbacks.delete(callback);
    };
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

    this.messageCallbacks.clear();
  }
}

let wsInstance: PositionsWebSocket | null = null;

export function getPositionsWebSocket(): PositionsWebSocket {
  if (!wsInstance) {
    wsInstance = new PositionsWebSocket();
  }
  return wsInstance;
}
