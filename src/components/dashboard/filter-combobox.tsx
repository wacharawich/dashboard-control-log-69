import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Dimension, Option } from "@/lib/sheet";
import { fmtNum } from "@/lib/sheet";

interface Props {
  dim: Dimension;
  value: string[];
  options: Option[];
  onChange: (value: string[]) => void;
}

export function FilterCombobox({ dim, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.value.toLowerCase().includes(q));
  }, [options, query]);

  const active = value.length > 0;
  const selectedSet = useMemo(() => new Set(value), [value]);

  const toggle = (optionValue: string) => {
    onChange(
      selectedSet.has(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  };

  const triggerLabel = !active
    ? "ทั้งหมด"
    : value.length <= 2
      ? value.join(" · ")
      : `${value.length} รายการ`;

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
          [{dim.code}]
        </span>
        <span className="truncate text-[11px] font-medium text-foreground/80">
          {dim.label}
        </span>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-9 w-full justify-between border-input bg-card px-3 font-normal shadow-xs",
              active
                ? "border-primary/50 text-primary hover:border-primary/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate text-left text-[13px]">{triggerLabel}</span>
              {active && value.length > 1 && (
                <span className="shrink-0 rounded-sm bg-primary/10 px-1 font-mono text-[10px] font-semibold text-primary">
                  {value.length}
                </span>
              )}
            </span>
            {active ? (
              <span
                role="button"
                tabIndex={0}
                className="rounded-sm p-0.5 hover:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Backspace") {
                    e.stopPropagation();
                    onChange([]);
                  }
                }}
              >
                <X className="size-3.5" />
              </span>
            ) : (
              <ChevronDown className="size-3.5 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[min(92vw,320px)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`ค้นหา ${dim.label}…`}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>ไม่พบ “{query}” ใน {dim.label}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__all__"
                  onSelect={() => onChange([])}
                  className="cursor-pointer aria-selected:bg-accent"
                >
                  <span className={cn("mr-2", !active ? "opacity-100" : "opacity-0")}>
                    <Check className="size-3.5 text-primary" />
                  </span>
                  <span className="text-[13px]">ทั้งหมด ({fmtNum(options.length)} ค่า)</span>
                  {active && (
                    <span className="ml-auto font-mono text-[10px] text-primary">
                      ล้าง
                    </span>
                  )}
                </CommandItem>
                {filtered.map((option) => {
                  const selected = selectedSet.has(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => toggle(option.value)}
                      className="cursor-pointer aria-selected:bg-accent"
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background",
                        )}
                      >
                        {selected && <Check className="size-3" />}
                      </span>
                      <span className="flex-1 truncate text-[13px]">{option.value}</span>
                      <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                        {fmtNum(option.count)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            <div className="border-t border-border/60 px-3 py-2 text-center font-mono text-[10px] text-muted-foreground">
              เลือกได้หลายค่า · คลิกเพื่อเลือก/ยกเลิก
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
