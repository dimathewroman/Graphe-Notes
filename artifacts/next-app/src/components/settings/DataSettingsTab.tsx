import { Cloud, Download, Server } from "lucide-react";

export function DataSettingsTab() {
  return (
    <section className="space-y-4">
      <div className="p-4 rounded-xl bg-background border border-panel-border flex items-start gap-4">
        <div className="p-2 bg-success/10 text-success rounded-lg shrink-0">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-medium mb-1">Backend Database Sync Active</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your notes are automatically saved to your private server database in real-time. Access them from any device securely.
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
  );
}
