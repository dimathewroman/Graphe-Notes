"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeft, LayoutGrid, CheckCircle2, Trash2 } from "lucide-react";
import { useAnimationConfig } from "@/hooks/use-motion";
import { useAppStore } from "@/store";
import { useBreakpoint } from "@/hooks/use-mobile";
import {
  useGetTemplates, useDeleteTemplate, getGetTemplatesQueryKey,
  useCreateNote, useCreateQuickBit,
  getGetNotesQueryKey, getGetQuickBitsQueryKey,
  getGetQuickBitQueryKey, getGetNoteQueryKey,
} from "@workspace/api-client-react";
import type { Template } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDemoMode } from "@/lib/demo-context";
import { cn } from "@/lib/utils";
import posthog from "posthog-js";

type Category = "all" | "capture" | "plan" | "reflect" | "create" | "mine";

const CATEGORY_LABELS: Record<Category, string> = {
  all: "All",
  capture: "Capture",
  plan: "Plan",
  reflect: "Reflect",
  create: "Create",
  mine: "Mine",
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  capture: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  plan: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" },
  reflect: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
  create: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
  mine: { bg: "bg-foreground/10", text: "text-muted-foreground" },
};

// Demo mode preset templates rendered without backend
const DEMO_PRESETS: Template[] = [
  { id: "preset-1", userId: null, name: "Brain Dump", description: "Get everything out of your head fast", category: "capture", isPreset: true, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Brain Dump" }] }, { type: "paragraph", content: [{ type: "text", text: "Get it out of your head. Spelling and order don't matter." }] }, { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }, { type: "listItem", content: [{ type: "paragraph" }] }, { type: "listItem", content: [{ type: "paragraph" }] }] }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "preset-2", userId: null, name: "Quick Meeting Notes", description: "What was discussed, actions, blockers", category: "capture", isPreset: true, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Meeting Notes" }] }, { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "My action items" }] }, { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Waiting on" }] }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "preset-3", userId: null, name: "Daily Momentum", description: "One thing, plate check, bonus energy", category: "plan", isPreset: true, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Today" }] }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "preset-4", userId: null, name: "Task Triage", description: "Do today vs. do eventually", category: "plan", isPreset: true, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Do today" }] }, { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Do eventually" }] }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "preset-5", userId: null, name: "Weekly Check-in", description: "Wins, friction, intentions, release", category: "reflect", isPreset: true, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Weekly Check-in" }] }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "preset-6", userId: null, name: "Mood + Energy Log", description: "Date, mood, energy, one-line why", category: "reflect", isPreset: true, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Mood + Energy" }] }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "preset-7", userId: null, name: "Project Brief", description: "What, who, done looks like, first steps", category: "create", isPreset: true, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Project Brief" }] }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "preset-8", userId: null, name: "Writing Draft", description: "Title, core message, open canvas", category: "create", isPreset: true, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "preset-9", userId: null, name: "Decision Log", description: "Options, values, decision + rationale", category: "plan", isPreset: true, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Decision" }] }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "preset-10", userId: null, name: "Gratitude + Wins", description: "Something good, handled well, grateful for", category: "reflect", isPreset: true, content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Gratitude + Wins" }] }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

function tiptapToHtml(content: Record<string, unknown>): string {
  if (!content || !Array.isArray((content as any).content)) return "";
  const nodes = (content as any).content as any[];

  const renderNode = (node: any): string => {
    if (!node) return "";
    if (node.type === "text") {
      let text = node.text ?? "";
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === "bold") text = `<strong>${text}</strong>`;
          if (mark.type === "italic") text = `<em>${text}</em>`;
        }
      }
      return text;
    }
    const inner = (node.content ?? []).map(renderNode).join("");
    if (node.type === "heading") return `<h${node.attrs?.level ?? 2} class="font-semibold text-foreground mb-1 mt-3">${inner}</h${node.attrs?.level ?? 2}>`;
    if (node.type === "paragraph") return `<p class="text-sm text-foreground/80 mb-2 leading-relaxed">${inner || '<span class="text-muted-foreground/50 italic">Start writing...</span>'}</p>`;
    if (node.type === "bulletList") return `<ul class="list-disc list-inside space-y-1 mb-2">${inner}</ul>`;
    if (node.type === "orderedList") return `<ol class="list-decimal list-inside space-y-1 mb-2">${inner}</ol>`;
    if (node.type === "listItem") return `<li class="text-sm text-foreground/80">${inner}</li>`;
    if (node.type === "blockquote") return `<blockquote class="border-l-2 border-primary/40 pl-3 text-muted-foreground italic mb-2">${inner}</blockquote>`;
    return inner;
  };

  return nodes.map(renderNode).join("");
}

export function TemplatePickerModal() {
  const { isTemplatePickerOpen, templatePickerContext, closeTemplatePicker, selectNote, selectQuickBit, setMobileView, addDemoNoteId, addDemoQbId } = useAppStore();
  const anim = useAnimationConfig();
  const bp = useBreakpoint();
  const isDemo = useDemoMode();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const { data: apiTemplates = [] } = useGetTemplates({
    query: { enabled: !isDemo && isTemplatePickerOpen, queryKey: getGetTemplatesQueryKey() },
  });

  const templates = isDemo ? DEMO_PRESETS : apiTemplates;
  const userTemplates = templates.filter(t => !t.isPreset);
  const presetTemplates = templates.filter(t => t.isPreset);
  const hasUserTemplates = userTemplates.length > 0;

  const deleteMut = useDeleteTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTemplatesQueryKey() });
        setDeleteConfirmId(null);
      },
    },
  });

  const createNoteMut = useCreateNote({
    mutation: {
      onSuccess: (newNote) => {
        queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
        selectNote(newNote.id);
        if (bp === "mobile") setMobileView("editor");
        posthog.capture("note_created_from_template", { note_id: newNote.id, timestamp: new Date().toISOString() });
        closeTemplatePicker();
      },
    },
  });

  const createQbMut = useCreateQuickBit({
    mutation: {
      onSuccess: (newQb) => {
        queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
        selectQuickBit(newQb.id);
        if (bp === "mobile") setMobileView("editor");
        posthog.capture("quickbit_created_from_template", { quickbit_id: newQb.id, timestamp: new Date().toISOString() });
        closeTemplatePicker();
      },
    },
  });

  const getContentHtml = (t: Template) =>
    typeof t.content === "object" && t.content !== null
      ? tiptapToHtml(t.content as Record<string, unknown>)
      : "";

  const handleUseTemplate = (template: Template) => {
    const contentJson = template.content;
    const contentHtml = getContentHtml(template);

    if (isDemo) {
      const tempId = -(Date.now());
      if (templatePickerContext === "quickbit") {
        const tempQb = {
          id: tempId, title: template.name, content: contentHtml,
          contentText: template.name, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData(getGetQuickBitQueryKey(tempId), tempQb);
        addDemoQbId(tempId);
        selectQuickBit(tempId);
      } else {
        const tempNote = {
          id: tempId, title: template.name, content: contentHtml, contentText: template.name,
          tags: [], pinned: false, favorite: false, vaulted: false, folderId: null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData(getGetNoteQueryKey(tempId), tempNote);
        addDemoNoteId(tempId);
        selectNote(tempId);
      }
      if (bp === "mobile") setMobileView("editor");
      posthog.capture(`${templatePickerContext}_created_from_template`, { timestamp: new Date().toISOString() });
      closeTemplatePicker();
      return;
    }

    if (templatePickerContext === "quickbit") {
      createQbMut.mutate({ data: { title: template.name, content: contentHtml } });
    } else {
      createNoteMut.mutate({ data: { title: template.name, content: contentHtml } });
    }
  };

  const handleStartBlank = () => {
    if (isDemo) {
      const tempId = -(Date.now());
      if (templatePickerContext === "quickbit") {
        const tempQb = {
          id: tempId, title: "", content: "<p></p>", contentText: "",
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData(getGetQuickBitQueryKey(tempId), tempQb);
        addDemoQbId(tempId);
        selectQuickBit(tempId);
      } else {
        const tempNote = {
          id: tempId, title: "Untitled Note", content: "<p></p>", contentText: "",
          tags: [], pinned: false, favorite: false, vaulted: false, folderId: null,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData(getGetNoteQueryKey(tempId), tempNote);
        addDemoNoteId(tempId);
        selectNote(tempId);
      }
      if (bp === "mobile") setMobileView("editor");
      closeTemplatePicker();
      return;
    }
    if (templatePickerContext === "quickbit") {
      createQbMut.mutate({ data: { title: "", content: "" } });
    } else {
      createNoteMut.mutate({ data: { title: "Untitled Note", content: "<p></p>" } });
    }
  };

  const openPreview = (template: Template) => {
    setIsTransitioning(true);
    setPreviewTemplate(template);
    setTimeout(() => setIsTransitioning(false), 260);
  };

  const closePreview = () => {
    setIsTransitioning(true);
    setPreviewTemplate(null);
    setTimeout(() => setIsTransitioning(false), 260);
  };

  const handleScroll = () => {
    setIsScrolled((scrollRef.current?.scrollTop ?? 0) > 8);
  };

  useEffect(() => {
    if (!isTemplatePickerOpen) {
      setPreviewTemplate(null);
      setActiveCategory("all");
      setDeleteConfirmId(null);
    }
  }, [isTemplatePickerOpen]);

  useEffect(() => {
    if (!isTemplatePickerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewTemplate) closePreview();
        else closeTemplatePicker();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isTemplatePickerOpen, previewTemplate, closeTemplatePicker]);

  const filteredPresets = activeCategory === "all" || activeCategory === "mine"
    ? presetTemplates
    : presetTemplates.filter(t => t.category === activeCategory);

  const filteredUserTemplates = activeCategory === "all" || activeCategory === "mine"
    ? userTemplates
    : [];

  const categories: Category[] = hasUserTemplates
    ? ["all", "capture", "plan", "reflect", "create", "mine"]
    : ["all", "capture", "plan", "reflect", "create"];

  if (!isTemplatePickerOpen) return null;

  const contextLabel = templatePickerContext === "quickbit" ? "Quick Bit" : "note";
  const isMobile = bp === "mobile";

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const modalVariants = isMobile
    ? {
        hidden: anim.level === "minimal" ? { opacity: 0 } : { y: "100%", opacity: anim.level === "reduced" ? 0 : 1 },
        visible: anim.level === "minimal" ? { opacity: 1 } : { y: 0, opacity: 1 },
        exit: anim.level === "minimal" ? { opacity: 0 } : { y: "100%", opacity: anim.level === "reduced" ? 0 : 1 },
      }
    : {
        hidden: anim.level === "minimal" ? { opacity: 0 } : anim.level === "reduced" ? { opacity: 0 } : { opacity: 0, scale: 0.96 },
        visible: anim.level === "minimal" ? { opacity: 1 } : anim.level === "reduced" ? { opacity: 1 } : { opacity: 1, scale: 1 },
        exit: anim.level === "minimal" ? { opacity: 0 } : anim.level === "reduced" ? { opacity: 0 } : { opacity: 0, scale: 0.96 },
      };

  const modalTransition = anim.level === "minimal"
    ? { duration: 0.1 }
    : anim.level === "reduced"
      ? { duration: 0.2, ease: "easeOut" as const }
      : { type: "spring" as const, stiffness: 300, damping: 28 };

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isTemplatePickerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: isMobile ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.25)" }}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: anim.level === "minimal" ? 0 : anim.level === "reduced" ? 0.15 : 0.2 }}
            onClick={() => {
              if (previewTemplate) closePreview();
              else closeTemplatePicker();
            }}
          />

          {/* Modal */}
          <motion.div
            className={cn(
              "fixed z-50 flex flex-col bg-[var(--color-surface-3,var(--color-panel))] overflow-hidden",
              isMobile
                ? "bottom-0 left-0 right-0 rounded-t-2xl h-[calc(100vh-48px)]"
                : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[560px] h-[70vh] rounded-xl shadow-lg luminance-border-top"
            )}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={modalTransition}
          >
            {/* Drag handle (mobile) */}
            {isMobile && (
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-9 h-1 rounded-full bg-border/60" />
              </div>
            )}

            {/* Shared container — picker and preview live here, slide between them */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Picker panel */}
              <motion.div
                className="absolute inset-0 flex flex-col"
                animate={{
                  x: previewTemplate ? (anim.level === "minimal" ? 0 : "-100%") : 0,
                  opacity: previewTemplate ? (anim.level === "minimal" ? 0 : anim.level === "reduced" ? 0 : 1) : 1,
                }}
                transition={anim.level === "minimal" ? { duration: 0.1 } : anim.level === "reduced" ? { duration: 0.15, ease: "easeOut" } : { duration: 0.25, ease: "easeInOut" }}
              >
                {/* Header */}
                <div className="px-5 pt-4 pb-3 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-medium text-muted-foreground tracking-[0.015em] uppercase">New {contextLabel} from template</p>
                    {!isMobile && (
                      <button
                        onClick={closeTemplatePicker}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-panel transition-colors"
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold tracking-[-0.005em] text-foreground">Templates</h2>
                </div>

                {/* Category chips — sticky below header */}
                <div className="px-4 pb-3 shrink-0">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        data-testid={`template-category-${cat}`}
                        onClick={() => setActiveCategory(cat)}
                        className={cn(
                          "h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap border transition-all shrink-0",
                          anim.useScale && "active:scale-[0.97]",
                          activeCategory === cat
                            ? "bg-primary/12 border-primary/30 text-primary font-semibold"
                            : "bg-transparent border-border text-muted-foreground hover:bg-panel hover:text-foreground"
                        )}
                        style={{ transition: "all 150ms ease-out" }}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scrollable card area */}
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto px-4 pb-4"
                >
                  {/* Scroll fade mask */}
                  {isScrolled && (
                    <div className="sticky top-0 h-2 bg-gradient-to-b from-[var(--color-surface-3,var(--color-panel))] to-transparent pointer-events-none z-10 -mx-4" />
                  )}

                  {/* User templates section */}
                  {hasUserTemplates && (activeCategory === "all" || activeCategory === "mine") && filteredUserTemplates.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.015em] text-muted-foreground mb-2 mt-2">My Templates</p>
                      <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                        {filteredUserTemplates.map((t, i) => (
                          <TemplateCard
                            key={t.id}
                            template={t}
                            index={i}
                            isMobile={isMobile}
                            isDeleteConfirm={deleteConfirmId === t.id}
                            onOpen={() => openPreview(t)}
                            onDeleteRequest={() => setDeleteConfirmId(t.id)}
                            onDeleteConfirm={() => deleteMut.mutate({ id: t.id })}
                            onDeleteCancel={() => setDeleteConfirmId(null)}
                            anim={anim}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preset templates section */}
                  {filteredPresets.length > 0 && activeCategory !== "mine" && (
                    <div>
                      {hasUserTemplates && <p className="text-[11px] font-semibold uppercase tracking-[0.015em] text-muted-foreground mb-2 mt-2">Presets</p>}
                      <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                        {filteredPresets.map((t, i) => (
                          <TemplateCard
                            key={t.id}
                            template={t}
                            index={i + (filteredUserTemplates.length)}
                            isMobile={isMobile}
                            isDeleteConfirm={false}
                            onOpen={() => openPreview(t)}
                            onDeleteRequest={() => {}}
                            onDeleteConfirm={() => {}}
                            onDeleteCancel={() => {}}
                            anim={anim}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mine tab empty state */}
                  {activeCategory === "mine" && filteredUserTemplates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-sm text-muted-foreground">No saved templates</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Save any note as a template from the editor menu</p>
                    </div>
                  )}

                  {/* Start blank link */}
                  <div className="mt-4 mb-2 text-center">
                    <button
                      data-testid="start-blank-btn"
                      onClick={handleStartBlank}
                      className="text-[13px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                    >
                      {templatePickerContext === "quickbit" ? "Start with a blank Quick Bit" : "Start with a blank page"}
                    </button>
                  </div>

                  {/* No user templates tip */}
                  {!hasUserTemplates && (
                    <p className="text-[11px] text-muted-foreground text-center mt-3">
                      Tip: Save any note as a template from the editor menu.
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Preview panel */}
              <motion.div
                className="absolute inset-0 flex flex-col"
                animate={{
                  x: previewTemplate ? 0 : (anim.level === "minimal" ? 0 : "30%"),
                  opacity: previewTemplate ? 1 : 0,
                  pointerEvents: previewTemplate ? "auto" : "none",
                }}
                transition={anim.level === "minimal" ? { duration: 0.1 } : anim.level === "reduced" ? { duration: 0.15, ease: "easeOut" } : { duration: 0.25, ease: "easeInOut" }}
              >
                {previewTemplate && (
                  <>
                    {/* Preview header */}
                    <div className="px-4 pt-4 pb-3 flex items-center gap-3 shrink-0">
                      <button
                        onClick={closePreview}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-panel transition-colors shrink-0"
                        aria-label="Back"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold truncate">{previewTemplate.name}</h3>
                      </div>
                      <span className={cn(
                        "text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0",
                        CATEGORY_COLORS[previewTemplate.category]?.bg ?? "bg-foreground/10",
                        CATEGORY_COLORS[previewTemplate.category]?.text ?? "text-muted-foreground"
                      )}>
                        {CATEGORY_LABELS[previewTemplate.category as Category] ?? previewTemplate.category}
                      </span>
                    </div>

                    {/* Preview content — static read-only HTML */}
                    <div className="flex-1 overflow-y-auto px-5 pb-2 relative">
                      <div
                        className="prose prose-sm max-w-none pointer-events-none select-none"
                        dangerouslySetInnerHTML={{ __html: getContentHtml(previewTemplate) }}
                      />
                      {/* Bottom fade mask */}
                      <div className="sticky bottom-0 h-4 bg-gradient-to-t from-[var(--color-surface-3,var(--color-panel))] to-transparent pointer-events-none -mx-5" />
                    </div>

                    {/* Footer CTA */}
                    <div className="px-4 py-4 border-t border-border/50 shrink-0">
                      <button
                        data-testid="use-template-btn"
                        onClick={() => handleUseTemplate(previewTemplate)}
                        disabled={createNoteMut.isPending || createQbMut.isPending}
                        className={cn(
                          "w-full h-11 rounded-md bg-primary text-primary-foreground text-[14px] font-semibold",
                          "hover:bg-primary/90 transition-all disabled:opacity-50",
                          anim.useScale && "hover:scale-[1.02] active:scale-[0.97]"
                        )}
                      >
                        Use this template
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

function TemplateCard({
  template, index, isMobile, isDeleteConfirm,
  onOpen, onDeleteRequest, onDeleteConfirm, onDeleteCancel, anim,
}: {
  template: Template;
  index: number;
  isMobile: boolean;
  isDeleteConfirm: boolean;
  onOpen: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  anim: ReturnType<typeof useAnimationConfig>;
}) {
  const catColors = CATEGORY_COLORS[template.category] ?? { bg: "bg-foreground/10", text: "text-muted-foreground" };
  const catLabel = CATEGORY_LABELS[template.category as Category] ?? template.category;

  const cardVariants = {
    hidden: anim.level === "full" ? { opacity: 0, y: 8 } : { opacity: 0 },
    visible: { opacity: 1, y: 0, transition: { delay: anim.level === "full" ? index * 0.04 : 0, duration: anim.level === "minimal" ? 0.1 : 0.2 } },
  };

  return (
    <motion.div
      data-testid="template-card"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "relative rounded-lg p-4 min-h-[72px] cursor-pointer group bg-[var(--color-surface-2,var(--color-card))] transition-all",
        anim.useScale && !isDeleteConfirm && "hover:-translate-y-px hover:shadow-sm active:scale-[0.98]",
        isDeleteConfirm && "bg-destructive/6 border border-destructive/20"
      )}
      onClick={() => !isDeleteConfirm && onOpen()}
    >
      {isDeleteConfirm ? (
        <div className="flex flex-col items-center justify-center gap-2 py-1">
          <p className="text-[14px] font-medium text-foreground text-center">Delete this template?</p>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteCancel(); }}
              className="h-8 px-3 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-panel transition-colors"
            >
              Keep it
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteConfirm(); }}
              className="h-8 px-3 rounded-md text-[13px] bg-destructive text-white hover:bg-destructive/90 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[14px] font-semibold text-foreground truncate pr-6 mb-1">{template.name}</p>
          {template.description && (
            <p className="text-[12px] text-muted-foreground truncate">{template.description}</p>
          )}
          <div className="flex justify-end mt-2">
            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", catColors.bg, catColors.text)}>
              {catLabel}
            </span>
          </div>
          {/* Delete button for user templates */}
          {!template.isPreset && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
              className={cn(
                "absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
                isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              aria-label="Delete template"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}
