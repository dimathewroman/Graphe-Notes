// Tiptap extension: pressing Enter in an empty list item / task item exits
// the list cleanly to a paragraph at the same depth, instead of inserting
// another empty bullet/check.
//
// Why this exists:
//   Tiptap's stock ListItem and TaskItem only bind Enter → splitListItem.
//   splitListItem returns false when the cursor is in an empty top-level
//   item, with a comment saying "let next command handle lifting" — but
//   no such command is bound, so the keystroke either no-ops or falls
//   through to ProseMirror's default keymap, which behaves inconsistently
//   (especially with our nested taskList from SmartTaskItem). This
//   extension makes the behavior explicit and reliable for both bullet/
//   ordered lists and task lists.
//
// Behavior:
//   • Cursor in NON-empty list item       → default split (new sibling)
//   • Cursor in EMPTY top-level item      → lift to paragraph after the list
//   • Cursor in EMPTY nested item         → lift one level (out of nesting)

import { Extension } from "@tiptap/react";
import { liftListItem } from "@tiptap/pm/schema-list";

export const ListExitOnEnterExtension = Extension.create({
  name: "listExitOnEnter",

  // Higher priority than the built-in ListItem / TaskItem (default 100) so
  // our handler runs first and the stock splitListItem only takes over for
  // non-empty items.
  priority: 200,

  addKeyboardShortcuts() {
    const handleEnter = () => {
      const { editor } = this;
      const { state } = editor;
      const { $from, empty } = state.selection;
      if (!empty) return false;

      // Walk up to find the nearest list item ancestor.
      let itemDepth = -1;
      let itemTypeName: "listItem" | "taskItem" | null = null;
      for (let d = $from.depth; d > 0; d--) {
        const name = $from.node(d).type.name;
        if (name === "listItem" || name === "taskItem") {
          itemDepth = d;
          itemTypeName = name as "listItem" | "taskItem";
          break;
        }
      }
      if (itemDepth < 0 || !itemTypeName) return false;

      // The list item is "empty" when its only content is an empty paragraph
      // (the cursor's parent block) AND there are no following children
      // (e.g. nested lists). This matches the user expectation: a single
      // blank line in a bullet/check should exit the list.
      const item = $from.node(itemDepth);
      const isEmptyItem =
        item.childCount === 1 &&
        item.firstChild?.type.name === "paragraph" &&
        item.firstChild.content.size === 0;
      if (!isEmptyItem) return false;

      const itemType = state.schema.nodes[itemTypeName];
      if (!itemType) return false;

      // liftListItem lifts the current item out of its wrapping list. For a
      // top-level item this turns it into a paragraph after the list; for a
      // nested item it promotes it one level toward the outer list. Either
      // way the user gets a clean exit instead of another empty bullet.
      return liftListItem(itemType)(state, editor.view.dispatch);
    };

    return {
      Enter: handleEnter,
    };
  },
});
