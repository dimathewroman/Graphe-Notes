import { useState } from "react";
import { X, Sparkles, Send, Loader2, Bot, CheckCheck } from "lucide-react";
import { useAppStore } from "@/store";
import { useAiComplete, useGetNote, useUpdateNote, getGetNotesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { IconButton } from "./ui/IconButton";
import { motion, AnimatePresence } from "framer-motion";

export function AIPanel() {
  const { isAIPanelOpen, setAIPanelOpen, selectedNoteId } = useAppStore();
  const queryClient = useQueryClient();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: note } = useGetNote(selectedNoteId || 0, { query: { enabled: !!selectedNoteId && isAIPanelOpen } as any });
  const updateNoteMut = useUpdateNote();
  const aiMut = useAiComplete();

  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");

  const handleComplete = async () => {
    if (!prompt.trim()) return;
    
    const apiKey = localStorage.getItem("ai_api_key") || "";
    const provider = (localStorage.getItem("ai_provider") || "openai") as any;
    const model = localStorage.getItem("ai_model") || "gpt-3.5-turbo";

    if (!apiKey) {
      alert("Please configure your AI API key in Settings first.");
      return;
    }

    try {
      setResult("");
      const res = await aiMut.mutateAsync({
        data: {
          provider,
          apiKey,
          model,
          prompt,
          noteContext: note ? `Title: ${note.title}\nContent:\n${note.contentText}` : null
        }
      });
      setResult(res.result);
    } catch (e) {
      console.error(e);
      setResult("Error generating response. Please check your API key and provider settings.");
    }
  };

  const insertIntoNote = async () => {
    if (!selectedNoteId || !note || !result) return;
    const newContent = note.content + `<br><p><strong>AI Suggestion:</strong></p><p>${result.replace(/\n/g, '<br>')}</p>`;
    await updateNoteMut.mutateAsync({ id: selectedNoteId, data: { content: newContent } });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    setResult("");
    setPrompt("");
  };

  const presetPrompts = [
    "Summarize this note",
    "Fix grammar and spelling",
    "Generate action items",
    "Make the tone more professional"
  ];

  return (
    <AnimatePresence>
      {isAIPanelOpen && (
        <motion.div 
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="w-80 border-l border-panel-border bg-panel flex flex-col h-screen shrink-0 absolute right-0 top-0 z-20 shadow-2xl"
        >
          <div className="p-4 border-b border-panel-border flex items-center justify-between bg-background/50">
            <div className="flex items-center gap-2 font-semibold text-indigo-400">
              <Sparkles className="w-4 h-4" />
              <span>AI Assistant</span>
            </div>
            <IconButton onClick={() => setAIPanelOpen(false)}>
              <X className="w-4 h-4" />
            </IconButton>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {!result && !aiMut.isPending && (
              <div className="space-y-2 mb-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Quick Actions</p>
                {presetPrompts.map(p => (
                  <button
                    key={p}
                    onClick={() => { setPrompt(p); }}
                    className="block w-full text-left p-2 rounded-lg bg-background border border-panel-border hover:border-primary/50 text-sm text-foreground transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {aiMut.isPending && (
              <div className="flex flex-col items-center justify-center py-12 text-indigo-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm font-medium animate-pulse">Thinking...</p>
              </div>
            )}

            {result && !aiMut.isPending && (
              <div className="flex flex-col gap-3">
                <div className="bg-background rounded-xl p-4 border border-indigo-500/20 shadow-inner">
                  <div className="flex items-center gap-2 mb-2 text-indigo-400 font-medium text-sm">
                    <Bot className="w-4 h-4" />
                    Response
                  </div>
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {result}
                  </div>
                </div>
                <button 
                  onClick={insertIntoNote}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  Insert into note
                </button>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-panel-border bg-background/50">
            <div className="relative flex items-end gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleComplete();
                  }
                }}
                placeholder={note ? "Ask about this note..." : "Ask AI..."}
                className="w-full bg-background border border-panel-border rounded-xl pl-3 pr-10 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none max-h-32 min-h-[44px]"
                rows={1}
              />
              <button
                onClick={handleComplete}
                disabled={aiMut.isPending || !prompt.trim()}
                className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-center text-muted-foreground mt-2">
              AI can make mistakes. Verify information.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
