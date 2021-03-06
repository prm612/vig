import * as WebSocket from "ws";
import { VHandler } from "./VHandler";
import { Server } from "http";
import * as debug from "debug";

const print = debug("vig:vwss");

export class VWSServer {

  public static ENTER = "enter";
  public static LEAVE = "leave";

  public static getInstance(): VWSServer {
    if (VWSServer.instance) {
      return VWSServer.instance;
    }
    VWSServer.instance = new VWSServer();
    return VWSServer.instance;
  }

  private static instance;

  public server;
  public eventsAndListeners: object = {};

  private constructor() {
  }
  public addEventListener(event: string, handler: VHandler) {
    let handlers = this.eventsAndListeners[event];
    if (!(handlers instanceof Array)) {
      handlers = [];
    }
    if (handlers.indexOf(handler) === -1) {
      handlers.push(handler);
    }
    this.eventsAndListeners[event] = handlers;
  }

  public broadcast(data, filter) {
    const wss = this.server;
    wss.clients.forEach(async (client) => {
      if (filter && !filter(client)) {
        return;
      }
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  public async onEvent(event, ws, req) {
    const enterListeners = this.eventsAndListeners[event];
    for (const handler of enterListeners) {
      await handler.wsEvent(event, null, ws, req);
    }
  }

  public async onEnter(ws, req) {
    await this.onEvent(VWSServer.ENTER, ws, req);
  }

  public async onLeave(ws, req) {
    await this.onEvent(VWSServer.LEAVE, ws, req);
  }

  public onEvents(ws, req) {
    ws.on("message", async (data) => {
      try {
        const json = JSON.parse(data);
        const event = json.event;
        const message = json.message;
        const eventListeners = this.eventsAndListeners[event];
        if (!eventListeners) {
          return;
        }
        for (const handler of eventListeners) {
          await handler.wsEvent(event, message, ws, req);
        }
      } catch (e) {
        print(e);
        return;
      }
    });
  }

  public start(server: Server) {
    const wss = new WebSocket.Server({ server });
    this.server = wss;
    wss.on("connection", async (ws, req) => {
      await this.onEnter(ws, req);
      this.onEvents(ws, req);
      ws.on("close", async () => {
        await this.onLeave(ws, req);
      })
    });
  }
}
