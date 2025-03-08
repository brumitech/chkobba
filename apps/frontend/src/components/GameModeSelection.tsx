"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/ui/button";

interface GameModeOption {
  id: "1v1" | "2v2";
  name: string;
  description: string;
  players: string;
  icon: string;
}

interface GameModeSelectionProps {
  onSelectMode: (mode: "1v1" | "2v2") => void;
}

export default function GameModeSelection({ onSelectMode }: GameModeSelectionProps) {
  const [selectedMode, setSelectedMode] = useState<"1v1" | "2v2" | null>(null);

  const gameModes: GameModeOption[] = [
    {
      id: "1v1",
      name: "Standard Mode",
      description: "Classic 1v1 Chkobba gameplay",
      players: "2-4 Players",
      icon: "👤"
    },
    {
      id: "2v2",
      name: "Team Mode",
      description: "Play in teams of 2 players each",
      players: "4 Players",
      icon: "👥"
    }
  ];

  return (
    <motion.div
      className="max-w-xl mx-auto p-6 bg-black/60 backdrop-blur-md rounded-lg shadow-xl"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-2xl font-bold text-white mb-4 text-center">Select Game Mode</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        {gameModes.map((mode) => (
          <motion.div
            key={mode.id}
            className={`
              p-5 rounded-lg border-2 cursor-pointer transition-all
              ${selectedMode === mode.id 
                ? 'border-yellow-400 bg-yellow-400/20' 
                : 'border-white/20 bg-white/10 hover:bg-white/20'}
            `}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedMode(mode.id)}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">{mode.icon}</div>
              <h3 className="font-bold text-lg text-white mb-1">{mode.name}</h3>
              <div className="text-white/70 text-sm mb-2">{mode.description}</div>
              <div className="bg-black/30 rounded-full px-3 py-1 inline-block text-xs font-medium text-white/80">
                {mode.players}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      <Button
        className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold"
        onClick={() => selectedMode && onSelectMode(selectedMode)}
        disabled={!selectedMode}
      >
        Continue
      </Button>
    </motion.div>
  );
}