"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  pointerWithin,
} from "@dnd-kit/core";

import Lobby from "../components/Lobby";
import Table from "../components/Table";
import Player from "../components/Player";
import DeckPile from "../components/DeckPile";
import TableCards from "../components/TableCards";
import ScoreDisplay from "../components/ScoreDisplay";
import ActionButtons from "../components/ActionButtons";
import LastCaptureIndicator from "../components/LastCaptureIndicator";
import TeamDisplay from "../components/TeamDisplay";
import GameModeSelection from "../components/GameModeSelection";
import TeamSelection from "../components/TeamSelection";

import { useGameState } from "../hooks/useGameState";

export default function Page() {
  const {
    gameState,
    playerId,
    selectedHandCardId,
    selectedTableCardIds,
    canCapture,
    canKoom,
    playerTeam,
    actions,
  } = useGameState();

  // State for setup steps
  const [gameMode, setGameMode] = useState<"1v1" | "2v2" | null>(null);
  const [playerName, setPlayerName] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !playerId) return;

    const overId = String(over.id);
    const activeId = String(active.id);

    // Reorder logic
    if (overId.startsWith("card-")) {
      const localPlayer = gameState?.players.find((p) => p.id === playerId);
      if (!localPlayer) return;

      const draggedCardId = activeId.replace("card-", "");
      const overCardId = overId.replace("card-", "");

      const currentHand = [...localPlayer.hand];
      const oldIndex = currentHand.findIndex((c) => c.id === draggedCardId);
      const baseIndex = currentHand.findIndex((c) => c.id === overCardId);
      if (oldIndex < 0 || baseIndex < 0) return;

      let targetIndex = baseIndex;
      if (event.activatorEvent && over.rect) {
        const pointerX = (event.activatorEvent as MouseEvent).clientX;
        const { left, right } = over.rect;
        const overCenter = (left + right) / 2;

        if (pointerX > overCenter) {
          targetIndex = baseIndex + 1;
        } else {
          targetIndex = baseIndex;
        }
      }

      const [moved] = currentHand.splice(oldIndex, 1);
      if (oldIndex < targetIndex) {
        targetIndex--;
      }
      currentHand.splice(targetIndex, 0, moved);

      actions.reorderHand(currentHand);
    }
  };

  const handlePlayCard = () => {
    if (selectedHandCardId) {
      actions.playCard(selectedHandCardId);
    }
  };

  const handleCaptureCards = () => {
    if (selectedHandCardId && selectedTableCardIds.length > 0) {
      actions.captureCards(selectedHandCardId, selectedTableCardIds);
    }
  };

  const handleKoom = () => {
    if (selectedHandCardId && canKoom) {
      actions.koom(selectedHandCardId);
    }
  };

  const handleJoinGame = (name: string) => {
    setPlayerName(name);
    setGameMode(null); // Reset to select game mode
  };

  const handleSelectGameMode = (mode: "1v1" | "2v2") => {
    setGameMode(mode);
    
    if (mode === "1v1") {
      // Join directly in 1v1 mode
      actions.joinGame(playerName, { gameMode: "1v1" });
    }
    // For 2v2, we'll show the team selection first
  };

  const handleSelectTeam = (teamId: string) => {
    // Join with team selection in 2v2 mode
    actions.joinGame(playerName, { 
      gameMode: "2v2",
      teamId 
    });
  };

  // STEP 1: Show lobby to enter player name
  if (!playerName) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-900 to-red-800">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Lobby onJoin={handleJoinGame} />
        </motion.div>
      </div>
    );
  }

  // STEP 2: Show game mode selection if player name is entered but game mode not selected
  if (playerName && !gameMode && !gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-900 to-red-800">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GameModeSelection onSelectMode={handleSelectGameMode} />
        </motion.div>
      </div>
    );
  }

  // STEP 3: Show team selection for 2v2 mode
  if (playerName && gameMode === "2v2" && !gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-900 to-red-800">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TeamSelection 
            teams={[
              { id: "team1", name: "Team 1", memberCount: 0 },
              { id: "team2", name: "Team 2", memberCount: 0 }
            ]} 
            onSelectTeam={handleSelectTeam} 
          />
        </motion.div>
      </div>
    );
  }

  // No gameState => show loading
  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-900 to-red-800">
        <motion.div
          className="bg-black/60 backdrop-blur-md p-6 rounded-lg shadow-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex flex-col items-center">
            <div className="mb-4 text-xl font-bold text-white">Connecting to game...</div>
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // During "playing" phase, show table + players
  if (gameState.gamePhase === "playing") {
    const localPlayerIndex = gameState.players.findIndex(
      (p) => p.id === playerId
    );

    if (localPlayerIndex === -1) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="p-6 bg-red-600 text-white rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p>
              Local player not found. Please refresh the page and try again.
            </p>
          </div>
        </div>
      );
    }

    const players = gameState.players;
    const numPlayers = players.length;
    
    // Get team mode
    const isTeamMode = gameState.gameMode === "2v2";

    // Position players based on game mode
    let bottomPlayer, leftPlayer, topPlayer, rightPlayer;
    
    if (isTeamMode) {
      // In team mode, position players by team first
      const localPlayer = players[localPlayerIndex];
      const localTeamId = localPlayer.teamId;
      
      // Get local player's teammate
      const teammate = players.find(p => p.id !== playerId && p.teamId === localTeamId);
      
      // Get opposing team players
      const opponents = players.filter(p => p.teamId !== localTeamId);
      
      bottomPlayer = localPlayer;
      topPlayer = teammate || null;
      
      if (opponents.length >= 1) leftPlayer = opponents[0];
      if (opponents.length >= 2) rightPlayer = opponents[1];
    } else {
      // Standard positioning for 1v1 mode
      bottomPlayer = players[localPlayerIndex];
      leftPlayer = numPlayers > 1 ? players[(localPlayerIndex + 1) % numPlayers] : null;
      topPlayer = numPlayers > 2 ? players[(localPlayerIndex + 2) % numPlayers] : null;
      rightPlayer = numPlayers > 3 ? players[(localPlayerIndex + 3) % numPlayers] : null;
    }

    const currentTurnPlayer = players.find(
      (p) => p.id === gameState.currentTurn
    );
    const isCurrentPlayersTurn = gameState.currentTurn === playerId;

    // Create player score objects for the ScoreDisplay
    const playerScores = players.map(player => ({
      id: player.id,
      name: player.name,
      score: player.score,
      isLocalPlayer: player.id === playerId
    }));

    // Find the player who made the last capture
    const lastCapturePlayer = players.find(
      p => p.id === gameState.lastCapturePlayerId
    );

    // Prepare team displays for 2v2 mode
    const teams = isTeamMode ? gameState.teams : [];
    const localPlayerTeamId = bottomPlayer?.teamId;
    const localTeam = teams.find(t => t.id === localPlayerTeamId);
    const opponentTeam = teams.find(t => t.id !== localPlayerTeamId);

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragEnd={handleDragEnd}
      >
        <Table
          currentTurnName={currentTurnPlayer?.name ?? "Unknown"}
          isCurrentPlayersTurn={isCurrentPlayersTurn}
          round={gameState.round}
          onTimeout={() => null}
        >
          <div className="flex flex-col gap-8 items-center justify-center">
            <div className="flex gap-8">
              <DeckPile cards={gameState.deck} />
              <div className="w-96 h-96">
                <TableCards 
                  cards={gameState.tableCards} 
                  onSelectCard={actions.selectTableCard}
                  selectedCardIds={selectedTableCardIds}
                />
              </div>
            </div>
          </div>

          {/* Team displays for 2v2 mode */}
          {isTeamMode && localTeam && (
            <TeamDisplay
              teamName={localTeam.name}
              members={players.filter(p => p.teamId === localTeam.id).map(p => ({
                id: p.id,
                name: p.name,
                isCurrentTurn: p.id === gameState.currentTurn
              }))}
              teamScore={localTeam.score}
              isLocalTeam={true}
              position="bottom"
            />
          )}

          {isTeamMode && opponentTeam && (
            <TeamDisplay
              teamName={opponentTeam.name}
              members={players.filter(p => p.teamId === opponentTeam.id).map(p => ({
                id: p.id,
                name: p.name,
                isCurrentTurn: p.id === gameState.currentTurn
              }))}
              teamScore={opponentTeam.score}
              isLocalTeam={false}
              position="top"
            />
          )}

          {bottomPlayer && (
            <Player
              name={bottomPlayer.name}
              hand={bottomPlayer.hand}
              captured={bottomPlayer.captured}
              score={bottomPlayer.score}
              isCurrentPlayer={bottomPlayer.id === gameState.currentTurn}
              isLocalPlayer={true}
              position="bottom"
              onSelectCard={actions.selectHandCard}
              selectedCardId={selectedHandCardId}
              lastCapture={bottomPlayer.id === gameState.lastCapturePlayerId}
            />
          )}

          {leftPlayer && (
            <Player
              name={leftPlayer.name}
              hand={leftPlayer.hand}
              captured={leftPlayer.captured}
              score={leftPlayer.score}
              isCurrentPlayer={leftPlayer.id === gameState.currentTurn}
              isLocalPlayer={false}
              position="left"
              onSelectCard={() => {}}
              selectedCardId={null}
              lastCapture={leftPlayer.id === gameState.lastCapturePlayerId}
            />
          )}

          {topPlayer && (
            <Player
              name={topPlayer.name}
              hand={topPlayer.hand}
              captured={topPlayer.captured}
              score={topPlayer.score}
              isCurrentPlayer={topPlayer.id === gameState.currentTurn}
              isLocalPlayer={false}
              position="top"
              onSelectCard={() => {}}
              selectedCardId={null}
              lastCapture={topPlayer.id === gameState.lastCapturePlayerId}
            />
          )}

          {rightPlayer && (
            <Player
              name={rightPlayer.name}
              hand={rightPlayer.hand}
              captured={rightPlayer.captured}
              score={rightPlayer.score}
              isCurrentPlayer={rightPlayer.id === gameState.currentTurn}
              isLocalPlayer={false}
              position="right"
              onSelectCard={() => {}}
              selectedCardId={null}
              lastCapture={rightPlayer.id === gameState.lastCapturePlayerId}
            />
          )}
        </Table>

        {/* Action buttons */}
        <ActionButtons
          onPlayCard={handlePlayCard}
          onCaptureCards={handleCaptureCards}
          onKoom={handleKoom}
          onResetSelection={actions.resetSelections}
          canCapture={canCapture}
          canKoom={canKoom}
          selectedHandCard={!!selectedHandCardId}
          selectedTableCards={selectedTableCardIds.length > 0}
          isMyTurn={isCurrentPlayersTurn}
        />

        {/* ScoreDisplay - shown for 1v1 mode */}
        {!isTeamMode && (
          <ScoreDisplay players={playerScores} round={gameState.round} />
        )}

        {/* Last capture indicator */}
        <AnimatePresence>
          {lastCapturePlayer && gameState.tableCards.length > 0 && (
            <LastCaptureIndicator playerName={lastCapturePlayer.name} />
          )}
        </AnimatePresence>

        <div className="fixed bottom-4 right-4 text-xs text-white/70 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm z-10">
          {isTeamMode ? 'Team Mode' : '1v1 Mode'} • Tip: Drag cards to rearrange your hand
        </div>
      </DndContext>
    );
  }

  // If the game is waiting for players
  if (gameState.gamePhase === "waiting") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-900 to-red-800">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8 bg-gradient-to-b from-red-800/90 to-red-900/90 backdrop-blur rounded-xl shadow-lg text-white border border-red-700"
        >
          <h2 className="text-2xl font-bold mb-4">Waiting for more players...</h2>
          
          {/* Show team info for 2v2 mode */}
          {gameState.gameMode === "2v2" && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Team Status</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {gameState.teams.map(team => (
                  <div 
                    key={team.id}
                    className={`
                      p-3 rounded-lg bg-black/30
                      ${team.id === playerTeam?.id ? 'border-2 border-yellow-500' : ''}
                    `}
                  >
                    <h4 className="font-bold">{team.name}</h4>
                    <div className="text-sm">{team.memberCount}/2 Players</div>
                    
                    {/* Show team members */}
                    <div className="mt-2 text-xs">
                      {gameState.players
                        .filter(p => p.teamId === team.id)
                        .map(p => (
                          <div 
                            key={p.id}
                            className={`py-1 px-2 rounded my-1 ${p.id === playerId ? 'bg-yellow-700/50' : 'bg-black/30'}`}
                          >
                            {p.name}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <p className="mb-4">
              Players connected: {gameState.players.length}/
              {gameState.gameMode === "2v2" ? "4" : "2-4"}
            </p>
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse delay-100"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse delay-200"></div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // If the game is finished
  if (gameState.gamePhase === "finished") {
    const isTeamMode = gameState.gameMode === "2v2";
    
    if (isTeamMode && gameState.winningTeam) {
      // Team game end screen
      const winningTeam = gameState.teams.find(t => t.id === gameState.winningTeam);
      const winningTeamMembers = gameState.players.filter(p => p.teamId === gameState.winningTeam);
      const isLocalPlayerWinner = winningTeamMembers.some(p => p.id === playerId);
      
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-900 to-red-800">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-8 bg-gradient-to-b from-red-800/90 to-red-900/90 backdrop-blur rounded-xl shadow-lg text-white max-w-xl border border-red-700"
          >
            <motion.h2
              className="text-3xl font-bold mb-2"
              initial={{ y: -20 }}
              animate={{ y: 0 }}
            >
              Game Over!
            </motion.h2>
            <motion.h3
              className="text-2xl mb-8 text-yellow-300"
              initial={{ y: -15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {isLocalPlayerWinner 
                ? `Your team (${winningTeam?.name}) won!` 
                : `Team ${winningTeam?.name} has won!`}
            </motion.h3>

            <div className="bg-black/20 p-4 rounded-lg mb-8">
              <h4 className="text-xl font-semibold mb-4">Team Scores</h4>
              <div className="space-y-4">
                {gameState.teams
                  .sort((a, b) => b.score - a.score)
                  .map((team, index) => {
                    const teamMembers = gameState.players.filter(p => p.teamId === team.id);
                    const isWinner = team.id === gameState.winningTeam;
                    const isLocalTeam = teamMembers.some(p => p.id === playerId);
                    
                    return (
                      <div
                        key={team.id}
                        className={`p-4 rounded ${
                          isWinner
                            ? 'bg-yellow-600/30 text-yellow-100'
                            : 'bg-black/20'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-black/30 w-6 h-6 flex items-center justify-center rounded-full">
                              {index + 1}
                            </span>
                            <span className="font-medium">
                              {team.name} 
                              {isLocalTeam && <span className="ml-2 text-xs">(Your Team)</span>}
                            </span>
                          </div>
                          <span className="text-xl font-bold">{team.score}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {teamMembers.map(member => (
                            <div 
                              key={member.id}
                              className="text-sm bg-black/20 p-2 rounded"
                            >
                              {member.name} 
                              {member.id === playerId && <span className="ml-1 text-xs">(You)</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <motion.button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-amber-600 text-black rounded-lg hover:from-yellow-500 hover:to-amber-500 transition-colors shadow-lg font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              New Game
            </motion.button>
          </motion.div>
        </div>
      );
    } else {
      // Individual winner game end screen
      const winnerName =
        gameState.players.find((p) => p.id === gameState.winner)?.name ||
        "Unknown";
      const isWinner = gameState.winner === playerId;

      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-900 to-red-800">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-8 bg-gradient-to-b from-red-800/90 to-red-900/90 backdrop-blur rounded-xl shadow-lg text-white max-w-xl border border-red-700"
          >
            <motion.h2
              className="text-3xl font-bold mb-2"
              initial={{ y: -20 }}
              animate={{ y: 0 }}
            >
              Game Over!
            </motion.h2>
            <motion.h3
              className="text-2xl mb-8 text-yellow-300"
              initial={{ y: -15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {isWinner ? "You won!" : `${winnerName} has won!`}
            </motion.h3>

            <div className="bg-black/20 p-4 rounded-lg mb-8">
              <h4 className="text-xl font-semibold mb-4">Final Scores</h4>
              <div className="space-y-2">
                {gameState.players
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className={`flex justify-between items-center py-2 px-4 rounded ${
                        player.id === playerId
                          ? "bg-yellow-600/30 text-yellow-100"
                          : "bg-black/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="bg-black/30 w-6 h-6 flex items-center justify-center rounded-full">
                          {index + 1}
                        </span>
                        <span className="font-medium">{player.name}</span>
                      </div>
                      <span className="text-xl font-bold">{player.score}</span>
                    </div>
                  ))}
              </div>
            </div>

            <motion.button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-amber-600 text-black rounded-lg hover:from-yellow-500 hover:to-amber-500 transition-colors shadow-lg font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              New Game
            </motion.button>
          </motion.div>
        </div>
      );
    }
  }

  // Default fallback
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-red-900 to-red-800">
      <div className="p-6 bg-black/60 backdrop-blur-md text-white rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-2">Loading game...</h2>
        <p>Please wait while we set up your game.</p>
      </div>
    </div>
  );
}