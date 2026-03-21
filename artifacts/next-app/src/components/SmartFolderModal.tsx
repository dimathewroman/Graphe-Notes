import { useState } from "react";
import { Zap, X, Plus, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCreateSmartFolder, useUpdateSmartFolder, getGetSmartFoldersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#10b981", label: "Emerald" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#ef4444", label: "Red" },
  { value: "#64748b", label: "Slate" },
];

interface SmartFolderModalProps {
  existing?: { id: number; name: string; tagRules: string[]; color: string | null };
  onClose: () => void;
}

export function SmartFolderModal({ existing, onClose }: SmartFolderModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(existing?.name ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(existing?.tagRules ?? []);
  const [color, setColor] = useState(existing?.color ?? COLORS[0].value);
  const [error, setError] = useState("");

  const createMut = useCreateSmartFolder({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetSmartFoldersQueryKey() }); onClose(); } }
  });
  const updateMut = useUpdateSmartFolder({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetSmartFoldersQueryKey() }); onClose(); } }
  });

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    if (tags.length === 0) { setError("Add at least one tag rule."); return; }
    if (existing) {
      await updateMut.mutateAsync({ id: existing.id, data: { name: name.trim(), tagRules: tags, color } });
    } else {
      await createMut.mutateAsync({ data: { name: name.trim(), tagRules: tags, color } });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-popover border border-panel-border rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-panel text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "20", border: `1px solid ${color}40` }}>
            <Zap className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{existing ? "Edit Smart Folder" : "New Smart Folder"}</h2>
            <p className="text-xs text-muted-foreground">Auto-filters notes by tags</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1 block">Folder Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError(""); }}
              placeholder="e.g. Work Notes"
              className="w-full bg-background border border-panel-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1 block">Tag Rules (notes with any of these tags)</label>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Add a tag..."
                  className="w-full bg-background border border-panel-border rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <button type="button" onClick={addTag} className="px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/10 border border-primary/20 text-primary">
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} className="opacity-60 hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-xs text-muted-foreground italic">No tags added yet</span>}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={cn("w-7 h-7 rounded-full border-2 transition-all", color === c.value ? "scale-110 border-white" : "border-transparent")}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-panel-border text-sm text-muted-foreground hover:bg-panel hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium transition-colors disabled:opacity-50"
            >
              {existing ? "Save Changes" : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
