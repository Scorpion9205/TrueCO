'use client';

import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DropdownMenu } from 'radix-ui';
import { signOut } from '@/lib/auth/session';
import { useSession } from '@/lib/auth/use-session';
import { type Theme, THEMES, useTheme } from '@/lib/theme';

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/** "Asha Sharma" -> "AS" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts.at(-1)![0]] : [parts[0]?.[0]];
  return letters.join('').toUpperCase() || '?';
}

export function UserMenu() {
  const t = useTranslations('Shell');
  const user = useSession()?.user;
  const [theme, setTheme] = useTheme();
  if (!user) return null;
  const role = user.roles[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t('userMenu', { name: user.name })}
        className="grid size-9 place-items-center rounded-full bg-foreground text-sm font-bold text-background outline-offset-2"
      >
        {initials(user.name)}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            {role ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t.has(`roles.${role}`) ? t(`roles.${role}` as 'roles.OWNER') : role}
              </p>
            ) : null}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Label className="px-3 pt-1.5 pb-1 text-xs font-semibold text-muted-foreground">
            {t('theme.label')}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as Theme)}
          >
            {THEMES.map((value) => {
              const Icon = THEME_ICONS[value];
              return (
                <DropdownMenu.RadioItem
                  key={value}
                  value={value}
                  // Keep the menu open so the change can be seen and undone
                  onSelect={(event) => event.preventDefault()}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[state=checked]:font-semibold data-[state=checked]:text-primary"
                >
                  <Icon className="size-4" aria-hidden />
                  {t(`theme.${value}`)}
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {/* SessionGate moves to the login page once the session is cleared */}
          <DropdownMenu.Item
            onSelect={() => void signOut()}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
          >
            <LogOut className="size-4" aria-hidden />
            {t('signOut')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
