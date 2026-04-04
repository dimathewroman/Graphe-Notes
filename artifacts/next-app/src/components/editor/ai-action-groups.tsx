// Action group definitions for the AI selection menus, plus shared editor font constants.

import {
  Scissors, ArrowDown, ArrowUp, Wand2, Check, BookOpen,
  RotateCcw, MessageSquare, ListChecks,
} from "lucide-react";

type PresetOption = { id: string; label: string };

type SubAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  presets?: PresetOption[];
};

export type ActionGroup = {
  label: string;
  icon: React.ReactNode;
  actions: SubAction[];
};

export const actionGroups: ActionGroup[] = [
  {
    label: "Adjust Length",
    icon: <Scissors className="w-3 h-3" />,
    actions: [
      {
        id: "shorter",
        label: "Shorter",
        icon: <ArrowDown className="w-3 h-3" />,
        presets: [
          { id: "shorter_25", label: "25% shorter" },
          { id: "shorter_50", label: "50% shorter" },
          { id: "shorter_custom", label: "Custom" },
        ],
      },
      {
        id: "longer",
        label: "Longer",
        icon: <ArrowUp className="w-3 h-3" />,
        presets: [
          { id: "longer_25", label: "25% longer" },
          { id: "longer_50", label: "50% longer" },
          { id: "longer_custom", label: "Custom" },
        ],
      },
    ],
  },
  {
    label: "Improve Writing",
    icon: <Wand2 className="w-3 h-3" />,
    actions: [
      { id: "proofread", label: "Proofread", icon: <Check className="w-3 h-3" /> },
      { id: "simplify", label: "Simplify", icon: <BookOpen className="w-3 h-3" /> },
      { id: "improve", label: "Improve", icon: <Wand2 className="w-3 h-3" /> },
    ],
  },
  {
    label: "Transform",
    icon: <RotateCcw className="w-3 h-3" />,
    actions: [
      { id: "rewrite", label: "Rewrite", icon: <RotateCcw className="w-3 h-3" /> },
      {
        id: "tone",
        label: "Change Tone",
        icon: <MessageSquare className="w-3 h-3" />,
        presets: [
          { id: "tone_casual", label: "Casual" },
          { id: "tone_professional", label: "Professional" },
          { id: "tone_friendly", label: "Friendly" },
          { id: "tone_direct", label: "Direct" },
          { id: "tone_custom", label: "Custom" },
        ],
      },
      {
        id: "summarize",
        label: "Summarize",
        icon: <BookOpen className="w-3 h-3" />,
        presets: [
          { id: "summarize_short", label: "Short (1–2 sentences)" },
          { id: "summarize_balanced", label: "Balanced (short paragraph)" },
          { id: "summarize_detailed", label: "Detailed (bullet points)" },
          { id: "summarize_custom", label: "Custom" },
        ],
      },
      { id: "extract_action_items", label: "Extract Action Items", icon: <ListChecks className="w-3 h-3" /> },
    ],
  },
];

// ─── Font picker constants ────────────────────────────────────────────────────

export const FONT_SIZE_PRESETS = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];
export const DEFAULT_FONT_SIZE = 12;

export const FONTS = [
  { label: "Default",          value: null,               family: "system-ui, sans-serif" },
  { label: "Inter",            value: "Inter",            family: "'Inter', sans-serif" },
  { label: "Georgia",          value: "Georgia",          family: "Georgia, serif" },
  { label: "Merriweather",     value: "Merriweather",     family: "'Merriweather', serif" },
  { label: "Courier New",      value: "Courier New",      family: "'Courier New', monospace" },
  { label: "Playfair Display", value: "Playfair Display", family: "'Playfair Display', serif" },
  { label: "Lato",             value: "Lato",             family: "'Lato', sans-serif" },
  { label: "Roboto",           value: "Roboto",           family: "'Roboto', sans-serif" },
] as const;
