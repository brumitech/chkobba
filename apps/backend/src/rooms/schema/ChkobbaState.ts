// apps/backend/src/rooms/schema/ChkobbaState.ts

import { Schema, type, ArraySchema } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";
import { CardState } from "./CardState";
import { TeamState } from "./TeamState";

export class ChkobbaState extends Schema {
  // Store players in an ArraySchema for seat-based logic
  @type([PlayerState])
  players = new ArraySchema<PlayerState>();

  @type([TeamState]) 
  teams = new ArraySchema<TeamState>();

  // Cards in the deck
  @type([CardState])
  deck = new ArraySchema<CardState>();

  // Cards on the table
  @type([CardState])
  tableCards = new ArraySchema<CardState>();

  // Current player's sessionId
  @type("string")
  currentTurn: string = "";

  @type("string") gameMode: GameMode = "1v1";

  // Game phase: "waiting" | "playing" | "finished"
  @type("string")
  gamePhase: "waiting" | "playing" | "finished" = "waiting";

  // Current turn start time in milliseconds
  @type("number")
  turnStartTime: number = 0;

  // Turn number (increments each turn)
  @type("number")
  turnNumber: number = 0;
  
  // Winner's sessionId when game is finished
  @type("string")
  winner: string = "";

  // Winning team's sessionId when game is finished
  @type("string") winningTeam: string = "";
  
  // Round number
  @type("number")
  round: number = 1;
  
  // Flag to indicate the last player who made a capture
  @type("string")
  lastCapturePlayerId: string = "";
}