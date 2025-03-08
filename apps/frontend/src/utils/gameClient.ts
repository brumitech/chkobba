// apps/frontend/src/utils/gameClient.ts

import { Client, Room } from "colyseus.js";
import { GameState } from "@/hooks/useGameState";
import { Card } from "@chkobba/shared";

interface GameClientCallbacks {
  onStateChange?: (state: GameState) => void;
  onError?: (error: string) => void;
  onLeave?: () => void;
  onActionSuccess?: (action: string, data: ActionSuccessData) => void;
  onPlayerJoin?: (player: { id: string; name: string, teamId?: string }) => void;
  onPlayerLeave?: (player: { id: string; name: string }) => void;
  onNewRound?: (roundNumber: number) => void;
  onGameStart?: (data: { gameMode: string }) => void;
  onGameEnd?: (data: GameEndData) => void;
  onPlayerTimeout?: (playerId: string) => void;
  onTeamChange?: (data: TeamChangeData) => void;
  onTeamKoom?: (data: TeamKoomData) => void;
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
  winningTeam?: string;
  teamName?: string;
  teamMembers?: Array<{ id: string; name: string }>;
}

interface TeamChangeData {
  playerId: string;
  playerName: string;
  teamId: string;
}

interface TeamKoomData {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
}

class GameClient {
  private client: Client;
  private room: Room<GameState> | null = null;
  private callbacks: GameClientCallbacks = {};

  constructor() {
    this.client = new Client("ws://localhost:3001");
  }

  async joinGame(
    playerName: string,
    options: { teamId?: string, gameMode?: "1v1" | "2v2" } = {}
  ): Promise<{ room: Room<GameState>; sessionId: string }> {
    try {
      const roomOptions = {
        name: playerName,
        ...options
      };

      const room = await this.client.joinOrCreate<GameState>("chkobba_room", roomOptions);
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

    room.onMessage("playerJoin", (data: { id: string; name: string, teamId?: string }) => {
      this.callbacks.onPlayerJoin?.(data);
    });

    room.onMessage("playerLeave", (data: { id: string; name: string }) => {
      this.callbacks.onPlayerLeave?.(data);
    });

    room.onMessage("newRound", (data: { round: number }) => {
      this.callbacks.onNewRound?.(data.round);
    });

    room.onMessage("gameStart", (data: { gameMode: string }) => {
      this.callbacks.onGameStart?.(data);
    });

    room.onMessage("gameEnd", (data: GameEndData) => {
      this.callbacks.onGameEnd?.(data);
    });

    room.onMessage("playerTimeout", (data: { playerId: string }) => {
      this.callbacks.onPlayerTimeout?.(data.playerId);
    });

    // Team-specific messages for 2v2 mode
    room.onMessage("teamChange", (data: TeamChangeData) => {
      this.callbacks.onTeamChange?.(data);
    });

    room.onMessage("teamKoom", (data: TeamKoomData) => {
      this.callbacks.onTeamKoom?.(data);
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

  selectTeam(teamId: string) {
    this.room?.send("selectTeam", { teamId });
  }

  leaveGame() {
    this.room?.leave();
  }
}

export const gameClient = new GameClient();