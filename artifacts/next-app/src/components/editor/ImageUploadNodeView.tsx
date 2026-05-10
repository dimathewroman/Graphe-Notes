// React NodeView for the imageUpload atom node.
// Renders a motion-aware upload placeholder. Replaced by a real image node
// once the upload round-trip completes.

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useMotionLevel } from "@/hooks/use-motion";

export function ImageUploadNodeView({ node }: NodeViewProps) {
  const fileName = (node.attrs.fileName as string) ?? "";
  const motion = useMotionLevel();

  return (
    <NodeViewWrapper as="div" className="my-4" contentEditable={false}>
      <div
        className="flex flex-col items-center justify-center gap-2 w-full max-w-xs mx-auto
                   rounded-xl border border-panel-border bg-panel px-6 py-8 text-muted-foreground
                   select-none"
        data-testid="image-upload-placeholder"
      >
        {motion === "full" ? (
          // Animated spinner
          <svg
            className="w-8 h-8 text-primary/70 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeDasharray="40 20"
            />
          </svg>
        ) : motion === "reduced" ? (
          // Static pulse dot (no rotation)
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <div className="w-3 h-3 rounded-full bg-primary/60" />
          </div>
        ) : (
          // Minimal — static icon only
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-primary/50" />
          </div>
        )}
        <p className="text-sm font-medium text-foreground/80">Uploading image</p>
        {fileName && (
          <p className="text-xs text-muted-foreground/70 truncate max-w-[200px]">{fileName}</p>
        )}
      </div>
    </NodeViewWrapper>
  );
}
