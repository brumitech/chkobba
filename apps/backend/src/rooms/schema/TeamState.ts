// apps/backend/src/rooms/schema/TeamState.ts

import { Schema, type } from "@colyseus/schema";

export class TeamState extends Schema {
  @type("string") id: string;
  @type("string") name: string;
  @type("number") score: number = 0;
  @type("number") memberCount: number = 0;

  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name;
  }
}