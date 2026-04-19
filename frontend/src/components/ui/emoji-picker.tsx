import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Comuns",
    emojis: ["📁","📂","⭐","🔥","💡","✅","❌","⚠️","🎯","🚀","💎","🏆","💰","📊","📈","📉","🔑","🎁","🎉","❤️","🟢","🔴","🟡","🟠","🔵","⚡","🌟","💫","🔔","📌"],
  },
  {
    label: "Pessoas & Trabalho",
    emojis: ["👤","👥","💼","🏢","🤝","👨‍💻","👩‍💻","🧑‍🎓","🧑‍💼","👨‍🏫","🧑‍🔬","👨‍⚕️","🧑‍🍳","👨‍🔧","🏋️","🧘","🏃","🚶","💪","🧠"],
  },
  {
    label: "Estudos & Conhecimento",
    emojis: ["📚","📖","📝","✏️","🎓","🏫","📐","📏","🔬","🔭","🧪","🧫","💻","🖥️","📓","📔","📒","📕","📗","📘","📙","🗒️","📄","📃","📜","🗃️"],
  },
  {
    label: "Finanças",
    emojis: ["💵","💴","💶","💷","💸","💳","🏦","💹","📊","📈","📉","🪙","💰","💱","🏧","🧾","⚖️","🤑","💲","🏠","🏗️","🏭"],
  },
  {
    label: "Saúde & Esporte",
    emojis: ["❤️","🫀","🏃","🚴","🏋️","🧘","⚽","🏀","🎾","🏊","🥗","🍎","💊","🩺","🩻","🧬","🌿","🥦","🥕","💧","😴","🛌"],
  },
  {
    label: "Tecnologia",
    emojis: ["💻","📱","🖥️","⌨️","🖱️","🖨️","📡","🔌","🔋","💾","💿","📀","🖲️","📺","📷","🎮","🕹️","🤖","⚙️","🔧","🔩","🛠️"],
  },
  {
    label: "Natureza & Lugares",
    emojis: ["🌍","🌎","🌏","🏔️","🏖️","🌊","🌲","🌳","🌴","🌵","🌻","🌸","🍀","☀️","🌙","⭐","🌈","❄️","🌧️","⛈️","🌪️","🏠","🏡","🏰"],
  },
  {
    label: "Objetos",
    emojis: ["⏰","📅","🗓️","⏳","🔍","🔎","💡","🔦","🕯️","📦","🎒","👜","🛍️","🧳","🔐","🔒","🔓","🗝️","🛒","🧲","📎","📌","✂️","🖊️","🖋️"],
  },
  {
    label: "Símbolos",
    emojis: ["✅","❎","🔘","🔲","🔳","▶️","⏸️","⏹️","⏺️","⏫","⏬","🔼","🔽","⬆️","⬇️","⬅️","➡️","↩️","↪️","🔄","🔃","➕","➖","✖️","➗","💯","🔰","♻️","⚜️","🆕"],
  },
];

const ALL_EMOJIS = EMOJI_GROUPS.flatMap(g => g.emojis);

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  size?: "sm" | "md";
}

export function EmojiPicker({ value, onChange, size = "md" }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    return ALL_EMOJIS.filter(e => e.includes(search));
  }, [search]);

  function pick(emoji: string) {
    onChange(emoji);
    setOpen(false);
    setSearch("");
  }

  const btnSize = size === "sm"
    ? "w-8 h-8 text-base"
    : "w-10 h-10 text-xl";

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${btnSize} flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted transition-colors`}
          title="Escolher emoji"
        >
          {value || "😀"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <Input
          placeholder="Buscar emoji…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-3 h-8 text-sm"
          autoFocus
        />
        <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
          {filtered ? (
            <div className="flex flex-wrap gap-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 w-full text-center">Nenhum emoji encontrado.</p>
              ) : filtered.map(e => (
                <EmojiBtn key={e} emoji={e} onPick={pick} />
              ))}
            </div>
          ) : (
            EMOJI_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1">
                  {group.emojis.map(e => (
                    <EmojiBtn key={e} emoji={e} active={e === value} onPick={pick} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmojiBtn({ emoji, active, onPick }: { emoji: string; active?: boolean; onPick: (e: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(emoji)}
      className={`w-8 h-8 text-lg flex items-center justify-center rounded hover:bg-muted transition-colors ${active ? "bg-[#C8DA2D]/20 ring-1 ring-[#C8DA2D]" : ""}`}
      title={emoji}
    >
      {emoji}
    </button>
  );
}
