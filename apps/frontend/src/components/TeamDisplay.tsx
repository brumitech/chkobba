"use client";

import { motion } from "framer-motion";

interface TeamMember {
  id: string;
  name: string;
  isCurrentTurn: boolean;
}

interface TeamDisplayProps {
  teamName: string;
  members: TeamMember[];
  teamScore: number;
  isLocalTeam: boolean;
  position: "top" | "bottom";
}

export default function TeamDisplay({
  teamName,
  members,
  teamScore,
  isLocalTeam,
  position
}: TeamDisplayProps) {
  const positionClass = position === "top" 
    ? "top-4 left-1/2 -translate-x-1/2" 
    : "bottom-4 left-1/2 -translate-x-1/2";

  return (
    <motion.div
      className={`absolute ${positionClass} z-20 flex flex-col items-center`}
      initial={{ opacity: 0, y: position === "top" ? -20 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div 
        className={`
          px-5 py-3 rounded-xl shadow-lg
          ${isLocalTeam 
            ? 'bg-gradient-to-r from-yellow-700 to-amber-800 border border-yellow-600/50' 
            : 'bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700/50'}
        `}
      >
        <div className="flex items-center justify-between gap-6">
          {/* Team name and score */}
          <div className="flex flex-col items-center">
            <div className={`text-lg font-bold ${isLocalTeam ? 'text-yellow-300' : 'text-white'}`}>
              {teamName}
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {teamScore} <span className="text-sm font-normal opacity-70">pts</span>
            </div>
          </div>

          {/* Team members */}
          <div className="flex flex-col gap-2">
            {members.map(member => (
              <div 
                key={member.id} 
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                  ${member.isCurrentTurn 
                    ? 'bg-red-600/70 text-white animate-pulse' 
                    : 'bg-black/40 text-white/80'}
                `}
              >
                {member.isCurrentTurn && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
                <span>{member.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}