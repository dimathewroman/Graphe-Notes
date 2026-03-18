import { useState } from "react";
import { X, Hash, Plus, Folder, Tag } from "lucide-react";
import { useUpdateFolder, getGetFoldersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useDemoMode } from "@/App";

interface Props {
  folder: { id: number; name: string; tagRules: string[] };
  onClose: () => void;
}

export function FolderEditModal({ folder, onClose }: Props) {
  const [name, setName] = useState(folder.name);
  const [tagRules, setTagRules] = useState<string[]>(folder.tagRules ?? []);
  const [tagInput, setTagInput] = useState("");
  const queryClient = useQueryClient();
  const isDemo = useDemoMode();

  const updateMut = useUpdateFolder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetFoldersQueryKey() });
        onClose();
      },
    },
  });

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!tag || tagRules.includes(tag)) { setTagInput(""); return; }
    setTagRules(prev => [...prev, tag]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setTagRules(prev => prev.filter(t => t !== tag));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (isDemo) {
      const folders = (queryClient.getQueryData(["/api/folders"]) as typeof folder[] | undefined) ?? [];
      queryClient.setQueryData(
        ["/api/folders"],
        folders.map(f => f.id === folder.id ? { ...f, name: name.trim(), tagRules } : f)
      );
      onClose();
      return;
    }
    updateMut.mutate({ id: folder.id, data: { name: name.trim(), tagRules } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-popover border border-panel-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Edit Folder</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-panel transition-colors text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="Folder name..."
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tag Rules</label>
            </div>
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
              Notes tagged with any of these will automatically appear in this folder.
            </p>

            {tagRules.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tagRules.map(tag => (
                  <span key={tag} className="group flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/10 border border-primary/20 text-primary">
                    <Hash className="w-2.5 h-2.5" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 opacity-60 hover:opacity-100 hover:text-destructive transition-all"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Add tag rule..."
                  className="w-full bg-background border border-panel-border rounded-xl pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 rounded-xl border border-panel-border text-muted-foreground hover:text-foreground hover:bg-panel transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {tagRules.length === 0 && (
              <p className="text-xs text-muted-foreground/60 mt-1.5 italic">No tag rules — behaves as a regular folder.</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-panel-border text-sm text-muted-foreground hover:text-foreground hover:bg-panel transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || updateMut.isPending}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {updateMut.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
