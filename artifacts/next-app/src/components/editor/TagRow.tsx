// Tag display row with inline add/remove. tagInput and showTagInput state are local.

import { memo, useRef, useState } from "react";
import { Hash, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimationConfig } from "@/hooks/use-motion";

// Fix 5: memo — only re-renders when tags or callbacks change
export const TagRow = memo(function TagRow({
  note,
  onAddTag,
  onRemoveTag,
}: {
  note: { tags?: string[] | null } | null | undefined;
  onAddTag: (tag: string) => Promise<void>;
  onRemoveTag: (tag: string) => Promise<void>;
}) {
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const anim = useAnimationConfig();

  const handleAdd = async () => {
    const tag = tagInput.trim().replace(/^#/, "");
    if (!tag || note?.tags?.includes(tag)) { setTagInput(""); setShowTagInput(false); return; }
    await onAddTag(tag);
    setTagInput("");
    setShowTagInput(false);
  };

  return (
    <div className="flex items-center flex-wrap gap-1.5 mb-8">
      <AnimatePresence initial={false} mode="popLayout">
        {note?.tags?.map(tag => (
          <motion.span
            key={tag}
            layout
            initial={{ scale: anim.useScale ? 0.8 : 1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={anim.spring}
            className="group flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/10 border border-primary/20 text-primary"
          >
            <Hash className="w-2.5 h-2.5" />
            {tag}
            <button onClick={() => onRemoveTag(tag)} className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all ml-0.5">
              <X className="w-2.5 h-2.5" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      {showTagInput ? (
        <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="flex items-center gap-1">
          <input
            ref={tagInputRef}
            autoFocus
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onBlur={() => { if (!tagInput) setShowTagInput(false); }}
            placeholder="tag name..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="text-xs bg-background border border-primary/30 rounded-full px-2.5 py-1 outline-none focus:border-primary text-foreground w-24"
          />
        </form>
      ) : (
        <button
          onClick={() => setShowTagInput(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-dashed border-panel-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <Plus className="w-2.5 h-2.5" />
          Add tag
        </button>
      )}
    </div>
  );
});
