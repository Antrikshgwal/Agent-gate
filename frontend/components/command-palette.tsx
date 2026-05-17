"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home,
  LayoutGrid,
  PlayCircle,
  BookOpenCheck,
  UserPlus,
  Cloud,
  CandlestickChart,
  Sparkles,
} from "lucide-react";

const PRESETS = [
  {
    id: "weather-london",
    label: "Run agent: weather in London",
    service: "OpenWeather",
    icon: Cloud,
    params: { city: "London", units: "metric" },
    method: "get_current_weather",
  },
  {
    id: "weather-tokyo",
    label: "Run agent: weather in Tokyo",
    service: "OpenWeather",
    icon: Cloud,
    params: { city: "Tokyo", units: "metric" },
    method: "get_current_weather",
  },
  {
    id: "price-btc",
    label: "Run agent: BTC price",
    service: "CoinGecko",
    icon: CandlestickChart,
    params: { ids: ["bitcoin"], vs_currency: "usd" },
    method: "get_price",
  },
];

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const runPreset = (preset: (typeof PRESETS)[number]) => {
    setOpen(false);
    const q = new URLSearchParams({
      preset: preset.id,
    });
    router.push(`/playground?${q.toString()}`);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages or run an agent…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}>
            <Home className="mr-2 h-4 w-4" />
            Home
          </CommandItem>
          <CommandItem onSelect={() => go("/services")}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Browse services
          </CommandItem>
          <CommandItem onSelect={() => go("/playground")}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Open playground
          </CommandItem>
          <CommandItem onSelect={() => go("/agents")}>
            <BookOpenCheck className="mr-2 h-4 w-4" />
            Agent launchpad
          </CommandItem>
          <CommandItem onSelect={() => go("/register")}>
            <UserPlus className="mr-2 h-4 w-4" />
            Register a service
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick runs">
          {PRESETS.map((p) => (
            <CommandItem key={p.id} onSelect={() => runPreset(p)}>
              <p.icon className="mr-2 h-4 w-4" />
              {p.label}
              <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                {p.service}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Discover">
          <CommandItem onSelect={() => go("/.well-known/agent.json")}>
            <Sparkles className="mr-2 h-4 w-4" />
            Agent manifest (.well-known/agent.json)
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
