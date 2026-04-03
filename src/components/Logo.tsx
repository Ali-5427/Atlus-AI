import React from 'react';
import { motion } from 'motion/react';

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const Logo = ({ size = 32, className, showText = true }: LogoProps) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer Hexagon/Shield Frame */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full text-accent"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.path
            d="M50 5L90 25V75L50 95L10 75V25L50 5Z"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          
          {/* Inner "A" stylized with neural nodes */}
          <motion.path
            d="M35 70L50 30L65 70M42 55H58"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          />

          {/* Neural Nodes (Circles) */}
          <motion.circle
            cx="50" cy="30" r="4"
            fill="currentColor"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.2, type: "spring" }}
          />
          <motion.circle
            cx="35" cy="70" r="4"
            fill="currentColor"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.3, type: "spring" }}
          />
          <motion.circle
            cx="65" cy="70" r="4"
            fill="currentColor"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.4, type: "spring" }}
          />
          
          {/* Pulse Effect */}
          <motion.path
            d="M50 5L90 25V75L50 95L10 75V25L50 5Z"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.3"
            initial={{ scale: 1, opacity: 0.3 }}
            animate={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        </svg>
      </div>
      
      {showText && (
        <motion.span 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-bold tracking-tight text-foreground"
        >
          Atlus <span className="text-accent">AI</span>
        </motion.span>
      )}
    </div>
  );
};
