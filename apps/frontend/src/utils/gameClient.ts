// apps/frontend/src/utils/gameClient.ts

import { Client, Room } from "colyseus.js";
import { GameState } from "@/hooks/useGameState";
import { Card } from "@chkobba/shared";

interface GameClientCallbacks {
  onStateChange?: (state: GameState) => void;
  onError?: (error: string) => void;
  onLeave?: () => void;
  onActionSuccess?: (action: string, data: ActionSuccessData) => void;
  onPlayerJoin?: (player: { id: string; name: string }) => void;
  onPlayerLeave?: (player: { id: string; name: string }) => void;
  onNewRound?: (roundNumber: number) => void;
  onGameStart?: () => void;
  onGameEnd?: (data: GameEndData) => void;
  onPlayerTimeout?: (playerId: string) => void;
}

// Define proper types instead of using 'any'
interface ActionSuccessData {
  cardId?: string;
  cardName?: string;
  capturedCount?: number;
}

interface GameEndData {
  winner?: string;
  playerName?: string;
  reason?: string;
}

class GameClient {
  private client: Client;
  private room: Room<GameState> | null = null;
  private callbacks: GameClientCallbacks = {};

  constructor() {
    this.client = new Client("ws://localhost:3001");
  }

  async joinGame(
    playerName: string
  ): Promise<{ room: Room<GameState>; sessionId: string }> {
    try {
      const room = await this.client.joinOrCreate<GameState>("chkobba_room", {
        name: playerName,
      });
      this.room = room;
      this.setupRoomListeners(room);
      return { room, sessionId: room.sessionId };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Join failed";
      this.callbacks.onError?.(errMsg);
      throw error;
    }
  }

  private setupRoomListeners(room: Room<GameState>) {
    room.onStateChange((newState) => {
      this.callbacks.onStateChange?.(newState);
    });

    room.onLeave(() => {
      this.callbacks.onLeave?.();
    });

    room.onError((code, message) => {
      this.callbacks.onError?.(`Room error ${code}: ${message}`);
    });

    room.onMessage("playSuccess", (data: ActionSuccessData) => {
      this.callbacks.onActionSuccess?.("play", data);
    });

    room.onMessage("captureSuccess", (data: ActionSuccessData) => {
      this.callbacks.onActionSuccess?.("capture", data);
    });

    room.onMessage("koomSuccess", (data: ActionSuccessData) => {
      this.callbacks.onActionSuccess?.("koom", data);
    });

    room.onMessage("error", (data: { message: string }) => {
      this.callbacks.onError?.(data.message);
    });

    room.onMessage("playerJoin", (data: { id: string; name: string }) => {
      this.callbacks.onPlayerJoin?.(data);
    });

    room.onMessage("playerLeave", (data: { id: string; name: string }) => {
      this.callbacks.onPlayerLeave?.(data);
    });

    room.onMessage("newRound", (data: { round: number }) => {
      this.callbacks.onNewRound?.(data.round);
    });

    room.onMessage("gameStart", () => {
      this.callbacks.onGameStart?.();
    });

    room.onMessage("gameEnd", (data: GameEndData) => {
      this.callbacks.onGameEnd?.(data);
    });

    room.onMessage("playerTimeout", (data: { playerId: string }) => {
      this.callbacks.onPlayerTimeout?.(data.playerId);
    });
  }

  setCallbacks(callbacks: GameClientCallbacks) {
    this.callbacks = callbacks;
  }

  reorderHand(newHand: Card[]) {
    this.room?.send("reorderHand", { newHand });
  }

  playCard(cardId: string) {
    this.room?.send("playCard", { cardId });
  }

  captureCards(cardId: string, capturedCardIds: string[]) {
    this.room?.send("captureCards", { cardId, capturedCardIds });
  }

  koom(cardId: string) {
    this.room?.send("koom", { cardId });
  }

  leaveGame() {
    this.room?.leave();
  }
}

export const gameClient = new GameClient();