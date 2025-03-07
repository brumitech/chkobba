// apps/frontend/src/components/game/Table.tsx
"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import Timer from "./Timer";

interface TableProps {
  currentTurnName?: string;
  isCurrentPlayersTurn: boolean;
  round: number;
  onTimeout: () => void;
  children?: ReactNode;
}

export default function Table({
  currentTurnName,
  isCurrentPlayersTurn,
  round,
  onTimeout,
  children,
}: TableProps) {
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Background with North African / Mediterranean theme */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-800 to-amber-700 p-4">
        {/* Felt table surface with Moroccan pattern */}
        <div
          className="relative w-full h-full rounded-3xl shadow-inner overflow-hidden"
          style={{
            backgroundColor: "#b8435e", // Rich red felt
            backgroundImage: `
              radial-gradient(circle, transparent 0%, rgba(0,0,0,0.2) 100%),
              url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.1' fill-rule='evenodd'%3E%3Cpath d='M30 30h30v30H30z'/%3E%3Cpath d='M0 30h30v30H0z'/%3E%3C/g%3E%3C/svg%3E")
            `,
            boxShadow: "inset 0 0 80px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* Decorative wooden trim */}
          <div className="absolute inset-0 rounded-3xl border-8 border-amber-900/50 pointer-events-none"></div>

          {/* Corner decorations */}
          <div className="absolute top-3 left-3 w-4 h-4 rounded-full bg-amber-800/70"></div>
          <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-amber-800/70"></div>
          <div className="absolute bottom-3 left-3 w-4 h-4 rounded-full bg-amber-800/70"></div>
          <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-amber-800/70"></div>

          {/* Timer, Turn Info and Round */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-4 left-4 flex items-center gap-2 z-10"
          >
            <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-white flex items-center shadow-lg border border-white/10">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse"></div>
              <span className="font-medium">{currentTurnName}&apos;s Turn</span>
            </div>
            <Timer onTimeout={onTimeout} active={isCurrentPlayersTurn} />
          </motion.div>

          {/* Round indicator */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 right-4 z-10"
          >
            <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-white shadow-lg border border-white/10">
              <span className="font-bold">Round {round}</span>
            </div>
          </motion.div>

          {/* Center area with bigger margins */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ padding: "6rem" }}
          >
            {children}
          </div>

          {/* Enhanced center decoration */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <motion.div
              className="w-96 h-96 rounded-full border-4 border-red-700/20"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 1,
                ease: "easeOut",
              }}
            ></motion.div>

            {/* Moroccan pattern decoration (invisible but helps visualization) */}
            <div className="absolute opacity-5 w-64 h-64 flex items-center justify-center">
              <span className="text-6xl font-serif">♠ ♥ ♦ ♣</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}