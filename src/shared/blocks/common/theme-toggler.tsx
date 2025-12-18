'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, SunDim } from 'lucide-react';
import { useTheme } from 'next-themes';

import { useAppContext } from '@/shared/contexts/app';
import { isConfigTrue } from '@/shared/lib/general-ui.client';
import { AnimatedThemeToggler } from '@/shared/components/magicui/animated-theme-toggler';
import { Button } from '@/shared/components/ui/button';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/shared/components/ui/toggle-group';

export function ThemeToggler({
  type = 'icon',
  className,
}: {
  type?: 'icon' | 'button' | 'toggle';
  className?: string;
}) {
  const { configs } = useAppContext();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!isConfigTrue(configs, 'general_theme_toggle_enabled')) {
    return null;
  }

  const handleThemeChange = (value: string) => {
    if (!value) return;
    setTheme(value);
  };

  if (type === 'button') {
    return (
      <Button variant="outline" size="sm" className="hover:bg-primary/10">
        <SunDim />
      </Button>
    );
  } else if (type === 'toggle') {
    if (!mounted) {
      return (
        <div
          aria-hidden="true"
          className={`h-8 w-[7.25rem] ${className ?? ''}`}
        />
      );
    }

    return (
      <ToggleGroup
        type="single"
        className={className}
        value={theme ?? 'system'}
        onValueChange={handleThemeChange}
        variant="outline"
      >
        <ToggleGroupItem value="light">
          <SunDim />
        </ToggleGroupItem>
        <ToggleGroupItem value="dark">
          <Moon />
        </ToggleGroupItem>
        <ToggleGroupItem value="system">
          <Monitor />
        </ToggleGroupItem>
      </ToggleGroup>
    );
  }

  return mounted ? (
    <AnimatedThemeToggler className={className} />
  ) : (
    <div aria-hidden="true" className={`h-8 w-8 ${className ?? ''}`} />
  );
}
