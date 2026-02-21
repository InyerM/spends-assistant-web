import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  delay?: number;
}

interface UseLongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onContextMenu: (e: React.SyntheticEvent) => void;
}

export function useLongPress({
  onLongPress,
  delay = 500,
}: UseLongPressOptions): UseLongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent): void => {
      // Only handle touch events
      if (e.pointerType !== 'touch') return;
      firedRef.current = false;
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onLongPress();
      }, delay);
    },
    [onLongPress, delay],
  );

  const onPointerUp = useCallback((): void => {
    clear();
  }, [clear]);

  const onPointerCancel = useCallback((): void => {
    clear();
  }, [clear]);

  const onContextMenu = useCallback((e: React.SyntheticEvent): void => {
    if (firedRef.current) {
      e.preventDefault();
    }
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel, onContextMenu };
}
