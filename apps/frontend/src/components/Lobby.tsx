"use client";

import { useState } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { useToast } from "@/ui/toast";
import { motion } from "framer-motion";

interface LobbyProps {
  onJoin: (playerName: string) => void;
}

export default function Lobby({ onJoin }: LobbyProps) {
  const [playerName, setPlayerName] = useState("");
  const { addToast } = useToast();

  const handleSubmit = () => {
    if (playerName.trim()) {
      onJoin(playerName.trim());
      addToast({
        title: "Welcome",
        description: `Joined as ${playerName}`,
      });
    } else {
      addToast({
        title: "Error",
        description: "Please enter a valid name",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div 
      className="max-w-md mx-auto p-8 bg-gradient-to-b from-red-900/90 to-red-800/90 backdrop-blur-md rounded-lg shadow-xl border border-red-700"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h1 
        className="text-3xl font-bold mb-2 text-yellow-300 text-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Chkobba
      </motion.h1>
      
      <motion.p 
        className="text-white/80 text-center mb-6"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        A traditional North African card game
      </motion.p>
      
      <motion.div
        className="space-y-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-xl font-bold mb-2 text-white">Enter your name</h2>
        <Input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Your name"
          className="bg-white/20 border-white/30 text-white placeholder:text-white/50"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />
        <Button 
          className="mt-4 w-full bg-yellow-600 hover:bg-yellow-500 text-black"
          onClick={handleSubmit}
        >
          Join Game
        </Button>
      </motion.div>
      
      <motion.div 
        className="mt-8 p-4 bg-black/20 rounded-lg text-white/80 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <h3 className="font-bold mb-2 text-yellow-300">How to play:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Capture cards from the table that match your card's rank</li>
          <li>Or capture combinations that sum to your card's value</li>
          <li>Score points by collecting the most cards, coins, and special cards</li>
          <li>First player to reach 11 points wins</li>
        </ul>
      </motion.div>
    </motion.div>
  );
}