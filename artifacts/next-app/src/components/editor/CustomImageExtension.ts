// Custom image TipTap extension — wraps the built-in Image extension with a
// React node view for selection UI, alt-text editing, and source badges.

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "./ImageNodeView";

export const CustomImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
