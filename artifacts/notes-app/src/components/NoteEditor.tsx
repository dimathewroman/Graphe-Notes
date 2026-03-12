import { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";

import { useAppStore } from "@/store";
import { 
  useGetNote, useUpdateNote, useDeleteNote, useToggleNotePin, useToggleNoteFavorite, 
  getGetNotesQueryKey, getGetNoteQueryKey, getGetTagsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Code, Heading1, Heading2, Heading3,
  Image as ImageIcon, MoreHorizontal, Trash2, Pin, Star, PanelLeftClose, PanelLeft, FileText
} from "lucide-react";
import { IconButton } from "./ui/IconButton";
import { cn, formatDate } from "@/lib/utils";

export function NoteEditor() {
  const { selectedNoteId, selectNote, isSidebarOpen, toggleSidebar } = useAppStore();
  const queryClient = useQueryClient();
  
  const { data: note, isLoading } = useGetNote(selectedNoteId || 0, { query: { enabled: !!selectedNoteId } });
  
  const updateNoteMut = useUpdateNote();
  const deleteNoteMut = useDeleteNote();
  const pinMut = useToggleNotePin();
  const favMut = useToggleNoteFavorite();

  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  
  // Tiptap setup
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false,
      }),
      UnderlineExt,
      TextStyle,
      Color,
      FontFamily,
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Start writing...' })
    ],
    content: note?.content || "",
    onUpdate: ({ editor }) => {
      handleContentChange(editor.getHTML(), editor.getText());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none',
      },
    },
  }, [selectedNoteId]); // Re-init when note changes if needed, but we handle it via useEffect

  // Sync state when note changes
  useEffect(() => {
    if (note && editor) {
      setTitle(note.title);
      if (editor.getHTML() !== note.content) {
        editor.commands.setContent(note.content, false); // false = don't emit update event
      }
    }
  }, [note?.id, editor]);

  // Debounced auto-save
  const debouncedSave = useCallback(
    (() => {
      let timeout: ReturnType<typeof setTimeout>;
      return (id: number, data: any) => {
        setSaveStatus("saving");
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          await updateNoteMut.mutateAsync({ id, data });
          queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
          setSaveStatus("saved");
        }, 800);
      };
    })(),
    []
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (selectedNoteId) {
      debouncedSave(selectedNoteId, { title: newTitle });
    }
  };

  const handleContentChange = (html: string, text: string) => {
    if (selectedNoteId) {
      debouncedSave(selectedNoteId, { content: html, contentText: text });
    }
  };

  const handleDelete = async () => {
    if (!selectedNoteId) return;
    if (confirm("Are you sure you want to delete this note?")) {
      await deleteNoteMut.mutateAsync({ id: selectedNoteId });
      queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      selectNote(null);
    }
  };

  const handleAction = async (action: 'pin' | 'fav') => {
    if (!selectedNoteId) return;
    if (action === 'pin') await pinMut.mutateAsync({ id: selectedNoteId });
    if (action === 'fav') await favMut.mutateAsync({ id: selectedNoteId });
    
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  };

  if (!selectedNoteId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground relative">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/empty-state-bg.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
        <FileText className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-medium mb-2 text-foreground/80">Select a note</h2>
        <p className="text-sm">Choose a note from the list or create a new one to start writing.</p>
      </div>
    );
  }

  if (isLoading || !editor) {
    return <div className="flex-1 flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-screen overflow-hidden">
      {/* Top Header */}
      <header className="h-14 border-b border-panel-border flex items-center justify-between px-4 shrink-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          {!isSidebarOpen && (
            <IconButton onClick={toggleSidebar} className="mr-2">
              <PanelLeft className="w-4 h-4" />
            </IconButton>
          )}
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse')} />
            {saveStatus === 'saved' ? 'Saved' : 'Saving...'}
            {note && <span className="ml-2 border-l border-panel-border pl-2">Updated {formatDate(note.updatedAt)}</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <IconButton onClick={() => handleAction('pin')} active={note?.pinned} title="Pin Note">
            <Pin className={cn("w-4 h-4", note?.pinned && "fill-current")} />
          </IconButton>
          <IconButton onClick={() => handleAction('fav')} active={note?.favorite} title="Favorite">
            <Star className={cn("w-4 h-4", note?.favorite && "fill-current text-yellow-500")} />
          </IconButton>
          <div className="w-px h-4 bg-panel-border mx-1" />
          <IconButton onClick={handleDelete} className="hover:text-destructive hover:bg-destructive/10" title="Delete">
            <Trash2 className="w-4 h-4" />
          </IconButton>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-panel-border overflow-x-auto bg-panel/30 shrink-0 hide-scrollbar">
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={<Bold className="w-4 h-4" />} />
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={<Italic className="w-4 h-4" />} />
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={<UnderlineIcon className="w-4 h-4" />} />
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} icon={<Strikethrough className="w-4 h-4" />} />
        
        <div className="w-px h-5 bg-panel-border mx-2 shrink-0" />
        
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={<Heading1 className="w-4 h-4" />} />
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={<Heading2 className="w-4 h-4" />} />
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} icon={<Heading3 className="w-4 h-4" />} />
        
        <div className="w-px h-5 bg-panel-border mx-2 shrink-0" />
        
        <ToolbarButton editor={editor} command={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} icon={<AlignLeft className="w-4 h-4" />} />
        <ToolbarButton editor={editor} command={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} icon={<AlignCenter className="w-4 h-4" />} />
        <ToolbarButton editor={editor} command={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} icon={<AlignRight className="w-4 h-4" />} />
        
        <div className="w-px h-5 bg-panel-border mx-2 shrink-0" />
        
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={<List className="w-4 h-4" />} />
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={<ListOrdered className="w-4 h-4" />} />
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} icon={<Quote className="w-4 h-4" />} />
        <ToolbarButton editor={editor} command={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} icon={<Code className="w-4 h-4" />} />
        
        <div className="w-px h-5 bg-panel-border mx-2 shrink-0" />
        
        <ToolbarButton editor={editor} command={() => {
          const url = window.prompt('URL');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }} active={false} icon={<ImageIcon className="w-4 h-4" />} />
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-12">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Note Title"
            className="w-full text-4xl font-bold bg-transparent border-none outline-none mb-8 text-foreground placeholder:text-muted-foreground/30 resize-none tracking-tight"
          />
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ editor, command, active, icon }: { editor: any, command: () => void, active: boolean, icon: React.ReactNode }) {
  return (
    <button
      onClick={command}
      className={cn(
        "p-1.5 rounded text-muted-foreground hover:bg-panel hover:text-foreground transition-colors",
        active && "bg-panel text-primary"
      )}
    >
      {icon}
    </button>
  );
}
