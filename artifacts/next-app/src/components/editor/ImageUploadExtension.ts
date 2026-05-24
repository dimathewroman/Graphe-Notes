// TipTap atom node for in-progress image uploads.
// Inserted immediately when an image file is selected; replaced with a real
// image node once the upload round-trip completes. This means blob: URLs never
// enter the document — the placeholder node has no src attribute.

import { Node, ReactNodeViewRenderer } from "@tiptap/react";
import { ImageUploadNodeView } from "./ImageUploadNodeView";

export const ImageUploadExtension = Node.create({
  name: "imageUpload",
  group: "block",
  atom: true,
  draggable: false,
  selectable: true,

  addAttributes() {
    return {
      // UUID generated at insert time — used to locate this node after async upload.
      id: {
        default: null,
        parseHTML: el => el.getAttribute("data-upload-id"),
        renderHTML: attrs => (attrs.id ? { "data-upload-id": attrs.id } : {}),
      },
      fileName: {
        default: "",
        parseHTML: el => el.getAttribute("data-file-name") ?? "",
        renderHTML: attrs => ({ "data-file-name": attrs.fileName }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="imageUpload"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-type": "imageUpload", ...HTMLAttributes }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageUploadNodeView);
  },
});
