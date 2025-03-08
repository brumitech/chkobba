"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/ui/button";

interface Team {
  id: string;
  name: string;
  memberCount: number;
}

interface TeamSelectionProps {
  teams: Team[];
  onSelectTeam: (teamId: string) => void;
  disabled?: boolean;
}

export default function TeamSelection({ teams, onSelectTeam, disabled = false }: TeamSelectionProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const handleTeamSelect = (teamId: string) => {
    setSelectedTeamId(teamId);
  };

  const handleConfirm = () => {
    if (selectedTeamId) {
      onSelectTeam(selectedTeamId);
    }
  };

  return (
    <motion.div
      className="max-w-md mx-auto p-6 bg-black/60 backdrop-blur-md rounded-lg shadow-xl"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-xl font-bold text-white mb-4">Select Your Team</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        {teams.map((team) => (
          <motion.div
            key={team.id}
            className={`
              p-4 rounded-lg border-2 cursor-pointer transition-all
              ${selectedTeamId === team.id 
                ? 'border-yellow-400 bg-yellow-400/20' 
                : 'border-white/20 bg-white/10 hover:bg-white/20'}
              ${team.memberCount >= 2 ? 'opacity-50' : 'opacity-100'}
            `}
            whileHover={{ scale: team.memberCount < 2 ? 1.03 : 1 }}
            whileTap={{ scale: team.memberCount < 2 ? 0.98 : 1 }}
            onClick={() => team.memberCount < 2 && handleTeamSelect(team.id)}
          >
            <div className="text-center">
              <h3 className="font-bold text-lg text-white">{team.name}</h3>
              <div className="mt-2 text-white/80 text-sm">
                {team.memberCount}/2 Players
              </div>
              
              {/* Progress bar */}
              <div className="w-full h-2 bg-white/20 rounded-full mt-3">
                <div 
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${(team.memberCount / 2) * 100}%` }}
                ></div>
              </div>
              
              {/* Status label */}
              <div className="mt-2 text-xs font-medium">
                {team.memberCount >= 2 ? (
                  <span className="text-red-400">Full</span>
                ) : (
                  <span className="text-green-400">Available</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      <Button
        className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold"
        onClick={handleConfirm}
        disabled={!selectedTeamId || disabled}
      >
        Join Team
      </Button>
    </motion.div>
  );
}