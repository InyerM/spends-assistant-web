'use client';

import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ChevronLeft } from 'lucide-react';

const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = 160;
const HINT_STORAGE_KEY = 'v1_hasSeenSwipeHint';

interface SwipeableRowProps {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete?: () => void;
  showHint?: boolean;
}

export function SwipeableRow({
  children,
  onEdit,
  onDelete,
  showHint = false,
}: SwipeableRowProps): React.ReactElement {
  const controls = useAnimation();
  const x = useMotionValue(0);
  const actionsOpacity = useTransform(x, [-ACTION_WIDTH, -SWIPE_THRESHOLD / 2, 0], [1, 0.5, 0]);
  const [swiped, setSwiped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hintVisible, setHintVisible] = useState((): boolean => {
    if (!showHint) return false;
    try {
      return !localStorage.getItem(HINT_STORAGE_KEY);
    } catch {
      return false;
    }
  });

  function dismissHint(): void {
    setHintVisible(false);
    try {
      localStorage.setItem(HINT_STORAGE_KEY, 'true');
    } catch {
      // localStorage not available
    }
  }

  function handleDragEnd(_: unknown, info: PanInfo): void {
    if (hintVisible) dismissHint();

    if (info.offset.x < -SWIPE_THRESHOLD) {
      void controls.start({
        x: -ACTION_WIDTH,
        transition: { type: 'spring', stiffness: 400, damping: 30 },
      });
      setSwiped(true);
    } else {
      void controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
      setSwiped(false);
    }
  }

  function close(): void {
    void controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
    setSwiped(false);
  }

  function handleEdit(): void {
    close();
    onEdit();
  }

  function handleDelete(): void {
    if (!onDelete) return;
    close();
    onDelete();
  }

  return (
    <div ref={containerRef} className='relative overflow-hidden rounded-lg'>
      <motion.div
        className='absolute top-0 right-0 flex h-full items-stretch'
        style={{ opacity: actionsOpacity }}>
        <Button
          variant='ghost'
          onClick={handleEdit}
          className='bg-transfer hover:bg-transfer/80 h-full w-20 cursor-pointer rounded-none text-white'>
          <Pencil className='h-5 w-5' />
        </Button>
        {onDelete && (
          <Button
            variant='ghost'
            onClick={handleDelete}
            className='bg-destructive hover:bg-destructive/80 h-full w-20 cursor-pointer rounded-none text-white'>
            <Trash2 className='h-5 w-5' />
          </Button>
        )}
      </motion.div>

      <motion.div
        drag='x'
        dragDirectionLock
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        className='relative z-10 bg-transparent'
        onClick={(): void => {
          if (swiped) close();
        }}>
        {children}
      </motion.div>

      {hintVisible && (
        <motion.div
          className='text-muted-foreground pointer-events-none absolute top-1/2 right-3 z-20 flex -translate-y-1/2 items-center gap-1'
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: [0, 1, 1, 0], x: [10, 0, -8, -8] }}
          transition={{ duration: 2, times: [0, 0.2, 0.7, 1], repeat: 1, repeatDelay: 0.5 }}
          onAnimationComplete={dismissHint}>
          <ChevronLeft className='h-4 w-4' />
        </motion.div>
      )}
    </div>
  );
}
