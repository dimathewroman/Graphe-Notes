"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useAnimationConfig } from "@/hooks/use-motion";
import { useAppStore } from "@/store";
import { useBreakpoint } from "@/hooks/use-mobile";
import { useCreateTemplate, getGetTemplatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDemoMode } from "@/lib/demo-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import posthog from "posthog-js";
import { Dialog } from "../ui/dialog";
import { Dialog as DialogPrimitive } from "radix-ui";

function stripImagesFromHtml(html: string): { html: string; hadImages: boolean } {
  const hadImages = /<img\s/i.test(html);
  const cleaned = html.replace(/<img\b[^>]*>/gi, "").replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "");
  return { html: cleaned, hadImages };
}

function htmlToTiptapJson(html: string): Record<string, unknown> {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "__html__" }],
      },
    ],
    __html: html,
  };
}

export function SaveAsTemplateDialog({
  noteTitle,
  noteContent,
}: {
  noteTitle: string;
  noteContent: string;
}) {
  const { isSaveAsTemplateOpen, closeSaveAsTemplate } = useAppStore();
  const anim = useAnimationConfig();
  const bp = useBreakpoint();
  const isDemo = useDemoMode();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");

  useEffect(() => {
    if (isSaveAsTemplateOpen) {
      setName(noteTitle?.trim() || "");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isSaveAsTemplateOpen, noteTitle]);

  const createMut = useCreateTemplate({
    mutation: {
      onSuccess: (template) => {
        queryClient.invalidateQueries({ queryKey: getGetTemplatesQueryKey() });
        posthog.capture("template_saved", { template_id: template.id, timestamp: new Date().toISOString() });
        closeSaveAsTemplate();
        const { hadImages } = stripImagesFromHtml(noteContent);
        toast.success(hadImages ? "Template saved. Images were not included since templates are text only." : "Template saved", {
          duration: hadImages ? 4000 : 3000,
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        });
      },
    },
  });

  const handleSave = () => {
    if (!name.trim()) return;
    const { html: strippedHtml } = stripImagesFromHtml(noteContent);
    const content = htmlToTiptapJson(strippedHtml);

    if (isDemo) {
      posthog.capture("template_saved", { timestamp: new Date().toISOString() });
      closeSaveAsTemplate();
      toast.success("Template saved", {
        duration: 3000,
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
      return;
    }

    createMut.mutate({
      data: {
        name: name.trim(),
        description: null,
        category: "mine",
        content,
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSave(); }
  };

  const isMobile = bp === "mobile";

  const dialogVariants = isMobile
    ? {
        hidden: anim.level === "minimal" ? { opacity: 0 } : { y: "100%", opacity: 1 },
        visible: { y: 0, opacity: 1 },
        exit: anim.level === "minimal" ? { opacity: 0 } : { y: "100%", opacity: 1 },
      }
    : {
        hidden: anim.level === "minimal" ? { opacity: 0 } : anim.level === "reduced" ? { opacity: 0 } : { opacity: 0, scale: 0.96 },
        visible: anim.level === "minimal" ? { opacity: 1 } : anim.level === "reduced" ? { opacity: 1 } : { opacity: 1, scale: 1 },
        exit: anim.level === "minimal" ? { opacity: 0 } : anim.level === "reduced" ? { opacity: 0 } : { opacity: 0, scale: 0.96 },
      };

  const dialogTransition = anim.level === "minimal"
    ? { duration: 0.1 }
    : anim.level === "reduced"
      ? { duration: 0.2, ease: "easeOut" as const }
      : { type: "spring" as const, stiffness: 320, damping: 28 };

  return (
    <Dialog open={isSaveAsTemplateOpen} onOpenChange={(open) => { if (!open) closeSaveAsTemplate(); }}>
      <DialogPrimitive.Portal forceMount>
        <AnimatePresence>
          {isSaveAsTemplateOpen && (
            <>
              <DialogPrimitive.Overlay forceMount asChild>
                <motion.div
                  className="fixed inset-0 z-50"
                  style={{ background: "rgba(0,0,0,0.25)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </DialogPrimitive.Overlay>
              <DialogPrimitive.Content forceMount asChild
                aria-describedby={undefined}
                onOpenAutoFocus={(e) => e.preventDefault()}>
                <motion.div
                  data-testid="save-as-template-dialog"
                  className={cn(
                    "fixed z-50 bg-[var(--color-surface-3,var(--color-panel))] shadow-lg",
                    isMobile
                      ? "bottom-0 left-0 right-0 rounded-t-2xl p-6 pb-8"
                      : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] rounded-xl p-6 luminance-border-top"
                  )}
                  variants={dialogVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={dialogTransition}
                >
                  <DialogPrimitive.Title className="text-lg font-semibold mb-3 tracking-tight">Save as template</DialogPrimitive.Title>
                  <p className="text-[13px] text-muted-foreground mb-4">
                    Save this note&rsquo;s structure as a reusable template.
                  </p>

                  <input
                    ref={inputRef}
                    value={name}
                    onChange={e => setName(e.target.value.slice(0, 60))}
                    onKeyDown={handleKeyDown}
                    placeholder="Template name"
                    maxLength={60}
                    data-testid="template-name-input"
                    className="w-full h-10 px-3 rounded-md bg-[var(--color-surface-1,var(--color-background))] border border-border text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all mb-5"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={closeSaveAsTemplate}
                      className="h-9 px-3 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-panel transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!name.trim() || createMut.isPending}
                      data-testid="save-template-btn"
                      className={cn(
                        "h-9 px-4 rounded-md bg-primary text-primary-foreground text-[14px] font-semibold transition-all disabled:opacity-50",
                        anim.useScale && "hover:bg-primary/90 active:scale-[0.97]"
                      )}
                    >
                      {createMut.isPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                </motion.div>
              </DialogPrimitive.Content>
            </>
          )}
        </AnimatePresence>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
