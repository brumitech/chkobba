// apps/backend/src/index.ts

import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import { monitor } from "@colyseus/monitor";
import { ChkobbaRoom } from "./rooms/ChkobbaRoom";

const port = Number(process.env.PORT || 3001);
const app = express();

const gameServer = new Server({
  server: createServer(app),
});

gameServer.define("chkobba_room", ChkobbaRoom); // Define ChkobbaRoom as a room

// Enable Colyseus monitor
app.use("/colyseus", monitor());

gameServer.listen(port);
console.log(`Chkobba Game Server listening on port ${port}`);