// TipTap TaskItem extension: auto-sorts checked sub-items and collapses nested lists.

import TaskItem from "@tiptap/extension-task-item";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// ── Smart Checklist Extension ──────────────────────────────────────────────
// Extends TaskItem with:
//   • collapsed attribute  → hides nested sub-lists when checked
//   • appendTransaction    → auto-sort checked sub-items to bottom of their list
//                          → uncheck parent resets all child items
const smartChecklistKey = new PluginKey("smartChecklist");

export const SmartTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-collapsed") === "true",
        renderHTML: (attrs) =>
          attrs.collapsed ? { "data-collapsed": "true" } : {},
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: smartChecklistKey,
        appendTransaction(transactions, oldState, newState) {
          if (transactions.some((t) => t.getMeta(smartChecklistKey))) return null;
          const mainTr = transactions.find((t) => t.docChanged);
          if (!mainTr) return null;

          // Find the first taskItem whose checked state just changed
          let changedPos: number | null = null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let changedNode: any = null;
          let wasChecked = false;

          newState.doc.descendants((node, pos) => {
            if (changedPos !== null) return false;
            if (node.type.name !== "taskItem") return true;
            const oldPos = mainTr.mapping.invert().map(pos);
            const oldNode = oldState.doc.nodeAt(oldPos);
            if (oldNode?.type.name !== "taskItem") return true;
            if ((oldNode.attrs.checked as boolean) === (node.attrs.checked as boolean)) return true;
            changedPos = pos;
            changedNode = node;
            wasChecked = oldNode.attrs.checked as boolean;
            return false;
          });

          if (changedPos === null || !changedNode) return null;

          let tr = newState.tr;
          let modified = false;
          const pos = changedPos;
          const node = changedNode;
          const isNowChecked = node.attrs.checked as boolean;

          if (isNowChecked) {
            // ── CHECKED ──────────────────────────────────────────
            // 1. Collapse any nested taskList
            let hasNestedList = false;
            node.forEach((child: { type: { name: string } }) => {
              if (child.type.name === "taskList") hasNestedList = true;
            });
            if (hasNestedList) {
              tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, collapsed: true });
              modified = true;
            }

            // 2. Sort to bottom of parent list if this is a sub-item
            const $pos = newState.doc.resolve(pos);
            if ($pos.depth >= 2) {
              const parentList = $pos.node($pos.depth - 1);
              const grandparent = $pos.node($pos.depth - 2);
              if (
                parentList.type.name === "taskList" &&
                grandparent.type.name === "taskItem"
              ) {
                const parentListEnd = $pos.end($pos.depth - 1);
                const currentNode = tr.doc.nodeAt(pos);
                if (currentNode) {
                  const nodeSize = currentNode.nodeSize;
                  if (pos + nodeSize < parentListEnd) {
                    const slice = tr.doc.slice(pos, pos + nodeSize);
                    tr = tr.delete(pos, pos + nodeSize);
                    tr = tr.insert(parentListEnd - nodeSize, slice.content);
                    modified = true;
                  }
                }
              }
            }
          } else {
            // ── UNCHECKED ─────────────────────────────────────────
            // 1. Expand collapsed nested list
            if (node.attrs.collapsed) {
              tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, collapsed: false });
              modified = true;
            }
            // 2. Reset all nested taskItem children to unchecked
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            node.descendants((child: any, childOffset: number) => {
              if (child.type.name === "taskItem" && child.attrs.checked) {
                tr = tr.setNodeMarkup(pos + 1 + childOffset, undefined, {
                  ...child.attrs,
                  checked: false,
                  collapsed: false,
                });
                modified = true;
              }
              return true;
            });
          }

          if (modified) {
            tr.setMeta(smartChecklistKey, true);
            return tr;
          }
          return null;
        },
      }),
    ];
  },
});
