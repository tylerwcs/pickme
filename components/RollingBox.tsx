'use client';

import { useState, useEffect, useRef } from 'react';
import { Participant } from '@/types';

interface RollingBoxProps {
  isRolling: boolean;
  winner: Participant | null;
  pool: Participant[];
  headers: string[]; // To know what to display
}

export default function RollingBox({ isRolling, winner, pool, headers }: RollingBoxProps) {
  const [current, setCurrent] = useState<Participant | null>(null);
  const [animationClass, setAnimationClass] = useState('');

  // Helper to identify the "Primary" field (usually Name)
  // Heuristic: If there's a field with "name" in it, use that as primary.
  // Otherwise, use the second field if available, or first.
  const getFieldStyle = (key: string, index: number, total: number) => {
    const keyLower = key.toLowerCase();
    
    // Style Mapping Logic
    // If 3 columns (standard ID, Name, Company) -> 0:Small, 1:Big, 2:Tag
    // If 2 columns -> 0:Big, 1:Small
    // If 1 column -> Big
    
    if (total === 3) {
      if (index === 0) return "text-xs text-gray-600 font-mono mb-1 tracking-widest font-bold"; // Top (ID) - Adjusted
      if (index === 1) return "text-base font-bold text-gray-900 leading-tight mb-1 line-clamp-2 px-1 text-center font-serif"; // Middle (Name) - Adjusted
      if (index === 2) return "text-[11px] font-bold text-pink-600 uppercase tracking-wider bg-pink-100 px-2 py-0.5 rounded-full"; // Bottom (Company) - Adjusted
    }
    
    if (total === 2) {
        if (index === 0) return "text-base font-bold text-gray-900 leading-tight mb-1 line-clamp-2 px-1 text-center font-serif"; // Main - Adjusted
        if (index === 1) return "text-xs text-gray-500 font-medium"; // Sub - Adjusted
    }

    return "text-base font-bold text-gray-900 leading-tight mb-1 line-clamp-2 px-1 text-center font-serif"; // Default Big - Adjusted
  };

  useEffect(() => {
    // Initial random state
    if (!current && pool.length > 0) {
        setCurrent(pool[Math.floor(Math.random() * pool.length)]);
    }
  }, [pool]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRolling && pool.length > 0) {
      setAnimationClass('animate-slot-spin');
      interval = setInterval(() => {
        const random = pool[Math.floor(Math.random() * pool.length)];
        setCurrent(random);
      }, 50); 
    } else if (!isRolling && winner) {
      setAnimationClass('');
      setCurrent(winner);
    }

    return () => clearInterval(interval);
  }, [isRolling, winner, pool]);

  if (!current) return <div className="bg-white border-4 border-yellow-500 h-32 w-full rounded-lg shadow-lg bg-gradient-to-b from-yellow-100 to-white"></div>;

  const validHeaders = headers.length > 0 ? headers : Object.keys(current.data);
  const displayFields = validHeaders.slice(0, 3); // Limit to 3 fields max visually

  return (
    <div className="relative bg-white border-4 border-yellow-500 h-full w-full rounded-lg shadow-[0_0_15px_rgba(234,179,8,0.5)] overflow-hidden bg-gradient-to-b from-gray-100 via-white to-gray-100">
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none z-10"></div>
      
      {/* Inner Frame */}
      <div className="absolute inset-1 border border-gray-200 rounded flex flex-col items-center justify-center p-2 bg-white">
        
        <div className={`flex flex-col items-center transition-transform duration-100 ${animationClass} w-full`}>
            {displayFields.map((header, idx) => (
                <div key={header} className={getFieldStyle(header, idx, displayFields.length)}>
                    {current.data[header] || '-'}
                </div>
            ))}
        </div>
      </div>
      
      {/* Decorative dots/lights */}
      <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-yellow-300 rounded-full shadow-sm z-20 animate-pulse"></div>
      <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-yellow-300 rounded-full shadow-sm z-20 animate-pulse delay-75"></div>
      <div className="absolute bottom-1 left-1 w-1.5 h-1.5 bg-yellow-300 rounded-full shadow-sm z-20 animate-pulse delay-150"></div>
      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-yellow-300 rounded-full shadow-sm z-20 animate-pulse delay-200"></div>
    </div>
  );
}
