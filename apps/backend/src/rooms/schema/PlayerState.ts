// apps/backend/src/rooms/schema/PlayerState.ts

import { Schema, type, ArraySchema } from "@colyseus/schema";
import { CardState } from "./CardState";

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") teamId = ""
  @type("boolean") isCurrentTurn = false;
  @type("boolean") connected = true;
  @type("number") score = 0;
  @type("boolean") lastCapture = false;
  @type([CardState]) hand = new ArraySchema<CardState>();
  @type([CardState]) captured = new ArraySchema<CardState>();

  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name;
  }
}