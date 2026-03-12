import { useState, useEffect } from "react";
import { X, Key, Cloud, Download, Server } from "lucide-react";
import { useAppStore } from "@/store";
import { IconButton } from "./ui/IconButton";
import { motion, AnimatePresence } from "framer-motion";

export function SettingsModal() {
  const { isSettingsOpen, setSettingsOpen } = useAppStore();
  
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-3.5-turbo");

  useEffect(() => {
    if (isSettingsOpen) {
      setProvider(localStorage.getItem("ai_provider") || "openai");
      setApiKey(localStorage.getItem("ai_api_key") || "");
      setModel(localStorage.getItem("ai_model") || "gpt-3.5-turbo");
    }
  }, [isSettingsOpen]);

  const handleSave = () => {
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("ai_model", model);
    setSettingsOpen(false);
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSettingsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-panel border border-panel-border rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-panel-border bg-background/50">
              <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
              <IconButton onClick={() => setSettingsOpen(false)}>
                <X className="w-5 h-5" />
              </IconButton>
            </div>

            <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
              
              {/* AI Settings */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-medium border-b border-panel-border pb-2">
                  <Key className="w-4 h-4" />
                  <h3>AI Provider Configuration</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
                    <select 
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google Gemini</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
                    <input 
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Model</label>
                    <input 
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. gpt-4"
                      className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </section>

              {/* Sync Settings */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-medium border-b border-panel-border pb-2">
                  <Cloud className="w-4 h-4" />
                  <h3>Cloud Sync & Data</h3>
                </div>
                
                <div className="p-4 rounded-xl bg-background border border-panel-border flex items-start gap-4">
                  <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Backend Database Sync Active</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your notes are automatically saved to your private server database in real-time. You can access them from any device securely.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button disabled className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-panel border border-panel-border text-muted-foreground text-sm opacity-50 cursor-not-allowed">
                    <Cloud className="w-4 h-4" />
                    Google Drive (Soon)
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-panel hover:bg-panel-hover border border-panel-border text-foreground transition-colors text-sm">
                    <Download className="w-4 h-4" />
                    Export All JSON
                  </button>
                </div>
              </section>

            </div>

            <div className="p-4 border-t border-panel-border bg-background/50 flex justify-end">
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-sm font-medium transition-colors shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95"
              >
                Save Settings
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
