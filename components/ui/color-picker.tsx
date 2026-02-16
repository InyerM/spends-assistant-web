'use client';

import { useRef, useState } from 'react';
import { Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#84CC16',
  '#22C55E',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#EC4899',
  '#F43F5E',
  '#6B7280',
  '#1F2937',
] as const;

const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps): React.ReactElement {
  const [inputValue, setInputValue] = useState(value || '');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  function handlePresetClick(color: string): void {
    onChange(color);
    setInputValue(color);
    setPopoverOpen(false);
  }

  function handleInputChange(raw: string): void {
    const val = raw.startsWith('#') ? raw : `#${raw}`;
    setInputValue(val);
    if (HEX_REGEX.test(val)) {
      onChange(val);
    }
  }

  function handleNativeColorChange(hex: string): void {
    const upper = hex.toUpperCase();
    onChange(upper);
    setInputValue(upper);
  }

  function handleClear(): void {
    onChange('');
    setInputValue('');
    setPopoverOpen(false);
  }

  function handleOpenChange(open: boolean): void {
    setPopoverOpen(open);
    if (open) {
      setInputValue(value || '');
    }
  }

  return (
    <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className={cn(
            'border-border flex h-11 w-full cursor-pointer items-center gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none sm:h-9',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            className,
          )}>
          <div
            className='border-border h-5 w-5 shrink-0 rounded-full border'
            style={{ backgroundColor: value || 'transparent' }}
          />
          <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
            {value || 'Pick a color'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-[260px] space-y-3 p-3' align='start'>
        <div className='grid grid-cols-4 gap-2'>
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type='button'
              className={cn(
                'h-8 w-full cursor-pointer rounded-md border-2 transition-transform hover:scale-110',
                value === color ? 'border-foreground' : 'border-transparent',
              )}
              style={{ backgroundColor: color }}
              onClick={(): void => handlePresetClick(color)}
              title={color}
            />
          ))}
        </div>
        <div className='flex items-center gap-2'>
          <div className='relative h-8 w-8 shrink-0'>
            <input
              ref={nativeInputRef}
              type='color'
              value={HEX_REGEX.test(inputValue) ? inputValue : '#3B82F6'}
              onChange={(e): void => handleNativeColorChange(e.target.value)}
              className='absolute inset-0 h-full w-full cursor-pointer opacity-0'
              tabIndex={-1}
            />
            <button
              type='button'
              className={cn(
                'border-border flex h-8 w-8 cursor-pointer items-center justify-center',
                'hover:bg-accent rounded-md border transition-colors',
              )}
              onClick={(): void => nativeInputRef.current?.click()}
              title='Custom color'>
              <Palette className='text-muted-foreground h-4 w-4' />
            </button>
          </div>
          <Input
            value={inputValue}
            onChange={(e): void => handleInputChange(e.target.value)}
            placeholder='#3B82F6'
            className='h-8 font-mono text-sm'
            maxLength={7}
          />
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='w-full cursor-pointer'
          onClick={handleClear}>
          Clear
        </Button>
      </PopoverContent>
    </Popover>
  );
}
