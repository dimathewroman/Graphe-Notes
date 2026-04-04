import { Node, ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { X } from "lucide-react";

// ─── URL parsing ──────────────────────────────────────────────────────────────

function parseVideoUrl(url: string): { embedUrl: string } | null {
  try {
    const u = new URL(url);

    // YouTube: youtube.com/watch?v=ID
    if (
      (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.pathname === "/watch"
    ) {
      const id = u.searchParams.get("v");
      if (id) return { embedUrl: `https://www.youtube.com/embed/${id}` };
    }

    // YouTube short links: youtu.be/ID
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return { embedUrl: `https://www.youtube.com/embed/${id}` };
    }

    // YouTube Shorts: youtube.com/shorts/ID
    if (
      (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.pathname.startsWith("/shorts/")
    ) {
      const id = u.pathname.replace("/shorts/", "");
      if (id) return { embedUrl: `https://www.youtube.com/embed/${id}` };
    }

    // YouTube embed (already an embed URL — normalise and accept)
    if (
      (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.pathname.startsWith("/embed/")
    ) {
      return { embedUrl: url };
    }

    // Vimeo: vimeo.com/VIDEO_ID
    if (u.hostname === "vimeo.com" || u.hostname === "www.vimeo.com") {
      const id = u.pathname.replace(/^\//, "");
      if (/^\d+$/.test(id)) return { embedUrl: `https://player.vimeo.com/video/${id}` };
    }

    // Vimeo embed: player.vimeo.com/video/ID
    if (u.hostname === "player.vimeo.com" && u.pathname.startsWith("/video/")) {
      return { embedUrl: url };
    }
  } catch {
    // not a URL
  }
  return null;
}

// ─── React NodeView ───────────────────────────────────────────────────────────

function VideoEmbedView({ node, deleteNode }: ReactNodeViewProps) {
  const embedUrl = node.attrs.embedUrl as string;

  return (
    <NodeViewWrapper>
      <div className="relative group my-3 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 select-none">
        {/* 16:9 aspect ratio wrapper */}
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title="Embedded video"
          />
        </div>
        {/* Delete button — visible on hover */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteNode();
          }}
          className="absolute top-2 right-2 z-10 hidden group-hover:flex items-center justify-center w-7 h-7 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          aria-label="Remove video"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

// ─── TipTap Extension ─────────────────────────────────────────────────────────

const videoEmbedPasteKey = new PluginKey("videoEmbedPaste");

export const VideoEmbedExtension = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      embedUrl: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-video-embed]",
        getAttrs: (el) => ({
          embedUrl: (el as HTMLElement).getAttribute("data-video-embed"),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        "data-video-embed": HTMLAttributes.embedUrl,
        style: "position:relative;width:100%;padding-bottom:56.25%;margin:12px 0;border-radius:8px;overflow:hidden;",
      },
      [
        "iframe",
        {
          src: HTMLAttributes.embedUrl,
          style: "position:absolute;inset:0;width:100%;height:100%;border:0;",
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
          allowfullscreen: "true",
          title: "Embedded video",
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: videoEmbedPasteKey,
        props: {
          handlePaste(view, event) {
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text) return false;
            const parsed = parseVideoUrl(text);
            if (!parsed) return false;

            const { schema, tr, selection } = view.state;
            const node = schema.nodes.videoEmbed.create({ embedUrl: parsed.embedUrl });
            view.dispatch(tr.replaceSelectionWith(node));
            return true;
          },
        },
      }),
    ];
  },
});

// ─── Exported helper for slash command ────────────────────────────────────────

export { parseVideoUrl };
