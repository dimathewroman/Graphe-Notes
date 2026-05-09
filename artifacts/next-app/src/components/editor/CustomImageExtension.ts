// Custom TipTap image extension — wraps the built-in Image extension with a
// React node view for selection UI, alt-text editing, and source badges.
// Adds a `masterPath` attribute so the download button can serve the master
// file directly without re-parsing it out of the signed proxy URL.

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "./ImageNodeView";

export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      masterPath: {
        default: null,
        parseHTML: element => element.getAttribute("data-master-path"),
        renderHTML: attributes => {
          if (!attributes.masterPath) return {};
          return { "data-master-path": attributes.masterPath };
        },
      },
      attachmentId: {
        default: null,
        parseHTML: element => element.getAttribute("data-attachment-id"),
        renderHTML: attributes => {
          if (!attributes.attachmentId) return {};
          return { "data-attachment-id": attributes.attachmentId };
        },
      },
      // Demo-mode only: blob URL of the original file (e.g. HEIC) so the download
      // button serves the original while displaying a converted JPEG in the editor.
      downloadUrl: {
        default: null,
        parseHTML: element => element.getAttribute("data-download-url"),
        renderHTML: attributes => {
          if (!attributes.downloadUrl) return {};
          return { "data-download-url": attributes.downloadUrl };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
