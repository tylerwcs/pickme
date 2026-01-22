'use client';

import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Participant, ChannelMessage } from '@/types';
import RollingBox from '@/components/RollingBox';
import { MOCK_PARTICIPANTS } from '@/lib/data';

export default function DisplayPage() {
  const [participants, setParticipants] = useState<Participant[]>(MOCK_PARTICIPANTS);
  const [winners, setWinners] = useState<Participant[]>([]);
  const [backgroundColor, setBackgroundColor] = useState('#2563eb'); // Default Blue
  const [gridColumns, setGridColumns] = useState(0);
  const [headers, setHeaders] = useState<string[]>(['Staff ID', 'Name', 'Company']);
  const [displayCount, setDisplayCount] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const lastRollTimestampRef = useRef<number>(0);

  useEffect(() => {
    const bc = new BroadcastChannel('lucky_draw_channel');
    
    // Polling fallback
    const pollState = async () => {
        try {
            const res = await fetch('/api/draw-state');
            const data: ChannelMessage = await res.json();
            handleMessage(data);
        } catch (e) {
            // ignore fetch errors
        }
    };

    const interval = setInterval(pollState, 1000); // Poll every second

    const handleMessage = (msg: ChannelMessage) => {
      if (msg.type === 'START_ROLL') {
        // Check timestamp to prevent duplicate processing
        const msgTimestamp = msg.timestamp || 0;
        if (msgTimestamp > 0 && msgTimestamp <= lastRollTimestampRef.current) {
          // This is an old message, ignore it
          return;
        }
        
        // Update timestamp reference
        if (msgTimestamp > 0) {
          lastRollTimestampRef.current = msgTimestamp;
        }
        
        // Update display count
        setDisplayCount(prev => {
            if (prev !== msg.count) return msg.count;
            return prev;
        });

        // Update background and grid columns first
        setBackgroundColor(prev => msg.backgroundColor || prev);
        setGridColumns(prev => msg.gridColumns);

        // Update pool and headers first, then set isRolling in next tick
        // This ensures RollingBox has the correct pool when it starts rolling
        if (msg.pool) {
          setParticipants(msg.pool);
        }
        if (msg.headers) {
          setHeaders(msg.headers);
        }
        
        // Clear winners immediately
        setWinners([]);
        
        // Use requestAnimationFrame to ensure DOM updates are processed
        // This is especially important in production where state updates might be batched differently
        requestAnimationFrame(() => {
          setIsRolling(prev => {
            if (!prev) {
              // New roll started
              return true;
            }
            return prev; // Keep current state if already rolling
          });
        });

      } else if (msg.type === 'STOP_ROLL') {
        setIsRolling(prev => {
            if (prev) {
                // Was rolling, now stopped -> New Winners!
                setWinners(msg.winners);
                triggerConfetti();
                return false;
            }
            // If already stopped, just ensure winners are synced (e.g. late joiner)
            if (JSON.stringify(winners) !== JSON.stringify(msg.winners)) {
                setWinners(msg.winners);
            }
            return false;
        });
      } else if (msg.type === 'RESET') {
        setDisplayCount(0);
        setWinners([]);
        setIsRolling(false);
      } else if (msg.type === 'UPDATE_BACKGROUND') {
        setBackgroundColor(msg.color);
      }
    };
    
    bc.onmessage = (event) => {
        handleMessage(event.data as ChannelMessage);
    };

    return () => {
        bc.close();
        clearInterval(interval);
    };
  }, []);

  const triggerConfetti = () => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
  };

  // Title based on state? Or just a static header?
  // Image showed "5th Place: Small household appliances". 
  // I don't have that setting yet, but I'll add a placeholder title.

  if (displayCount === 0) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center transition-all duration-500"
        style={{ background: backgroundColor }}
      >
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-4 text-white drop-shadow-md">PickMe</h1>
          <p className="text-2xl opacity-80 text-white drop-shadow-md">Waiting for Admin to start...</p>
        </div>
      </div>
    );
  }

  const getContainerStyle = () => {
    const GAP = 16; // 1rem = 16px (gap-4)

    if (gridColumns > 0) {
      // Use Flexbox with calculated widths to enforce columns AND center the last row
      return {
        display: 'flex',
        flexWrap: 'wrap' as const,
        justifyContent: 'center',
        width: '100%',
        maxWidth: '95vw',
        gap: `${GAP}px`,
      };
    }
    
    // Auto mode (flexbox)
    return {
      display: 'flex',
      flexWrap: 'wrap' as const,
      justifyContent: 'center',
      maxWidth: '95vw',
      gap: `${GAP}px`,
    };
  };

  const GAP = 16;

  // Determine text color based on background luminance roughly
  // Or just use a drop shadow or safe color. White with shadow works on most.
  // But let's stick to the previous white header.
  
  return (
    <div 
      className="min-h-screen p-8 flex flex-col transition-all duration-500"
      style={{ background: backgroundColor }}
    >
      <div className="flex-1 flex justify-center items-center overflow-auto">
        <div style={getContainerStyle()}>
          {Array.from({ length: displayCount }).map((_, index) => (
            <div 
              key={index} 
              className="h-[110px]"
              style={{
                width: gridColumns > 0 
                  ? `calc((100% - ${(gridColumns - 1) * GAP}px) / ${gridColumns} - 0.1px)` 
                  : '250px'
              }}
            >
              <RollingBox 
                isRolling={isRolling} 
                winner={winners[index] || null} 
                pool={participants}
                headers={headers}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

