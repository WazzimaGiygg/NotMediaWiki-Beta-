import { Response } from 'express';
import { INITIAL_EVENTS, WikiEvent } from '../data/seedData';

export class EventStreamService {
  private events: WikiEvent[] = [...INITIAL_EVENTS];
  private clients: Set<Response> = new Set();
  private maxHistory: number = 200;
  private maxClients: number = 50;

  public getHistory(limit: number = 50): WikiEvent[] {
    const clamped = Math.max(1, Math.min(limit, 100));
    return this.events.slice(-clamped).reverse();
  }

  /**
   * Registers a client response for Server-Sent Events.
   * Returns false if max simultaneous connections limit is reached.
   */
  public registerClient(res: Response): boolean {
    if (this.clients.size >= this.maxClients) {
      return false;
    }
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
    });
    return true;
  }

  public publish(event: Omit<WikiEvent, 'id' | 'meta'> & { traceId?: string }): WikiEvent {
    const eventId = `evt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const fullEvent: WikiEvent = {
      id: eventId,
      meta: {
        uri: `https://wikimedia.mesh/wiki/${encodeURIComponent(event.page_title)}`,
        request_id: event.traceId || `req-trace-${Date.now()}`,
        id: eventId,
        dt: new Date().toISOString(),
        domain: 'en.wikipedia.org',
        stream: 'mediawiki.recentchange',
      },
      database: 'enwiki',
      page_title: event.page_title,
      page_namespace: event.page_namespace,
      rev_id: event.rev_id,
      rev_timestamp: new Date().toISOString(),
      rev_sha1: event.rev_sha1,
      rev_minor_edit: event.rev_minor_edit,
      rev_len: event.rev_len,
      user_text: event.user_text,
      comment: event.comment,
      type: event.type,
    };

    this.events.push(fullEvent);
    if (this.events.length > this.maxHistory) {
      this.events.shift();
    }

    // Broadcast to SSE clients
    const payload = `data: ${JSON.stringify(fullEvent)}\n\n`;
    this.clients.forEach(client => {
      try {
        client.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    });

    return fullEvent;
  }

  public getClientCount(): number {
    return this.clients.size;
  }
}

export const eventStreamService = new EventStreamService();
