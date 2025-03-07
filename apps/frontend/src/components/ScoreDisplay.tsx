"use client";

import { motion } from "framer-motion";

interface PlayerScore {
  id: string;
  name: string;
  score: number;
  isLocalPlayer: boolean;
}

interface ScoreDisplayProps {
  players: PlayerScore[];
  round: number;
}

export default function ScoreDisplay({ players, round }: ScoreDisplayProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-4 right-4 z-10 bg-black/70 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-white/10"
    >
      <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></span>
        Scoreboard
        <span className="text-sm font-normal opacity-70 ml-2">Round {round}</span>
      </h3>
      
      <div className="space-y-2">
        {sortedPlayers.map((player, index) => (
          <div 
            key={player.id}
            className={`flex items-center justify-between ${
              player.isLocalPlayer ? "text-yellow-300 font-bold" : "text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 text-xs">
                {index + 1}
              </span>
              <span>{player.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono">{player.score}</span>
              <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-500 to-yellow-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (player.score / 11) * 100)}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 text-xs text-white/70 border-t border-white/20 pt-2">
        First to reach 11 points wins
      </div>
    </motion.div>
  );
}