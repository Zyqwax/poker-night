import React, { useRef, useState, useCallback, useEffect } from 'react';
import { soundManager } from '../utils/sound.js';

interface HoldButtonProps {
  onTrigger: () => void;
  disabled?: boolean;
  holdDurationMs?: number; // default: 500ms
  className?: string;
  progressColor?: string;
  children: React.ReactNode;
  soundType?: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  title?: string;
}

export const HoldButton: React.FC<HoldButtonProps> = ({
  onTrigger,
  disabled = false,
  holdDurationMs = 500,
  className = '',
  progressColor = 'bg-white/20',
  children,
  soundType,
  title,
}) => {
  const [isHolding, setIsHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTriggeredRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsHolding(false);
  }, []);

  const startHold = useCallback(
    (e: React.SyntheticEvent) => {
      if (disabled) return;
      e.stopPropagation();

      isTriggeredRef.current = false;
      setIsHolding(true);
      soundManager.playClick();

      timerRef.current = setTimeout(() => {
        isTriggeredRef.current = true;
        setIsHolding(false);
        soundManager.playHoldComplete();

        if (soundType === 'fold') {
          soundManager.playFold();
        } else if (soundType === 'check') {
          soundManager.playCheck();
        } else if (soundType === 'call' || soundType === 'raise' || soundType === 'all-in') {
          soundManager.playChips();
        }

        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate(35);
          } catch {}
        }

        onTrigger();
      }, holdDurationMs);
    },
    [disabled, holdDurationMs, onTrigger, soundType]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      cancelHold();
    }
  }, [disabled, cancelHold]);

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative overflow-hidden select-none touch-manipulation transition-transform ${
        isHolding ? 'scale-[0.98]' : 'active:scale-[0.98]'
      } ${className}`}
      style={{ WebkitTouchCallout: 'none' }}
    >
      {/* Background Animated Progress Fill (Left to Right) */}
      <span
        className={`absolute inset-0 ${progressColor} pointer-events-none origin-left transition-transform ease-linear`}
        style={{
          transform: isHolding ? 'scaleX(1)' : 'scaleX(0)',
          transitionDuration: isHolding ? `${holdDurationMs}ms` : '120ms',
        }}
      />

      {/* Bottom Glowing Accent Progress Line */}
      <span
        className="absolute bottom-0 left-0 right-0 h-1 bg-amber-300 pointer-events-none origin-left transition-transform ease-linear shadow-sm"
        style={{
          transform: isHolding ? 'scaleX(1)' : 'scaleX(0)',
          transitionDuration: isHolding ? `${holdDurationMs}ms` : '100ms',
        }}
      />

      {/* Button Content */}
      <span className="relative z-10 flex items-center justify-center w-full h-full gap-1">
        {children}
      </span>
    </button>
  );
};
