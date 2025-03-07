"use client";

import { motion } from "framer-motion";

interface LastCaptureIndicatorProps {
  playerName: string;
}

export default function LastCaptureIndicator({ playerName }: LastCaptureIndicatorProps) {
  return (
    <motion.div
      className="fixed bottom-8 left-8 z-20 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-lg shadow-lg px-4 py-3 text-black"
      initial={{ opacity: 0, scale: 0.8, x: -50 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.8, x: -50 }}
    >
      <div className="flex items-center gap-2">
        <motion.div 
          className="w-4 h-4 bg-yellow-300 rounded-full"
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [1, 0.7, 1] 
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
        <div>
          <h3 className="font-bold">Last Capture</h3>
          <p className="text-sm">{playerName} made the last capture</p>
        </div>
      </div>
    </motion.div>
  );
}