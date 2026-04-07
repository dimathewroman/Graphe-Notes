// Touch swipe handler: swipe right on a list item to indent it, swipe left
// to outdent it. Mobile/iPad parity for the desktop Tab / Shift+Tab keys on
// bullet lists, ordered lists, and task lists.
//
// Implementation notes:
//   • Listeners are registered directly on the editor DOM via the plugin's
//     `view()` lifecycle so we can pass `{ passive: false }` on touchmove and
//     legitimately preventDefault when the gesture commits to a horizontal
//     swipe. ProseMirror's `handleDOMEvents` would not give us that control.
//   • We use a direction lock: until the user has moved more than the
//     horizontal threshold AND the X delta dominates the Y delta, the gesture
//     stays "open" and the page can still scroll vertically. Once locked, we
//     consume touchmove so the page doesn't try to swipe-back / scroll
//     horizontally underneath us.
//   • The dispatch happens on touchend, not on threshold cross — this gives
//     the user a chance to cancel a swipe by dragging back near the start.

import { Extension } from "@tiptap/react";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { sinkListItem, liftListItem } from "@tiptap/pm/schema-list";

const swipeIndentKey = new PluginKey("swipeIndent");

// Pixels of horizontal travel before we treat the gesture as a swipe.
const SWIPE_THRESHOLD_PX = 50;
// If the user has moved more than this on the Y axis before locking, we
// assume they're scrolling and bail out.
const VERTICAL_SLOP_PX = 20;
// Maximum gesture duration. Anything slower than this reads as a hesitant
// drag, not a swipe, so we ignore it.
const SWIPE_MAX_DURATION_MS = 900;

interface ActiveSwipe {
  startX: number;
  startY: number;
  startTime: number;
  // Position of the list item (PM doc position, pointing at the item itself).
  itemPos: number;
  // "listItem" for bullet/ordered, "taskItem" for task lists.
  itemTypeName: "listItem" | "taskItem";
  // Once we've decided this is a horizontal swipe, lock and start preventing
  // default on subsequent touchmove events to suppress page scroll.
  locked: boolean;
}

// Walk up the resolved position to find the nearest list item ancestor.
function findListItemFromDom(
  view: EditorView,
  target: EventTarget | null,
): { pos: number; typeName: "listItem" | "taskItem" } | null {
  if (!(target instanceof Element)) return null;
  const li = target.closest("li");
  if (!li || !view.dom.contains(li)) return null;

  let pmPos: number;
  try {
    pmPos = view.posAtDOM(li, 0);
  } catch {
    return null;
  }
  if (pmPos == null || pmPos < 0) return null;

  const $pos = view.state.doc.resolve(pmPos);
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    const name = node.type.name;
    if (name === "listItem" || name === "taskItem") {
      return { pos: $pos.before(depth), typeName: name };
    }
  }
  return null;
}

export const SwipeIndentExtension = Extension.create({
  name: "swipeIndent",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: swipeIndentKey,
        view(editorView) {
          const dom = editorView.dom;
          let active: ActiveSwipe | null = null;

          const reset = () => {
            active = null;
          };

          const onTouchStart = (e: TouchEvent) => {
            // Single-finger only — multi-touch is for pinch zoom etc.
            if (e.touches.length !== 1) {
              reset();
              return;
            }
            const t = e.touches[0];
            const found = findListItemFromDom(editorView, e.target);
            if (!found) {
              reset();
              return;
            }
            active = {
              startX: t.clientX,
              startY: t.clientY,
              startTime: Date.now(),
              itemPos: found.pos,
              itemTypeName: found.typeName,
              locked: false,
            };
          };

          const onTouchMove = (e: TouchEvent) => {
            if (!active) return;
            if (e.touches.length !== 1) {
              reset();
              return;
            }
            const t = e.touches[0];
            const dx = t.clientX - active.startX;
            const dy = t.clientY - active.startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (!active.locked) {
              // The user is clearly scrolling — abandon the swipe.
              if (absDy > VERTICAL_SLOP_PX && absDy > absDx) {
                reset();
                return;
              }
              // Lock once horizontal motion clearly dominates and exceeds the
              // threshold. The 1.5x factor keeps gentle diagonal drags out.
              if (absDx > SWIPE_THRESHOLD_PX && absDx > absDy * 1.5) {
                active.locked = true;
              }
            }

            if (active.locked) {
              // Suppress page scroll / iOS swipe-back so the user's finger
              // doesn't unintentionally navigate or scroll the editor body.
              e.preventDefault();
            }
          };

          const onTouchEnd = (e: TouchEvent) => {
            const state = active;
            active = null;
            if (!state) return;
            if (Date.now() - state.startTime > SWIPE_MAX_DURATION_MS) return;

            const t = e.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - state.startX;
            const dy = t.clientY - state.startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDx < SWIPE_THRESHOLD_PX) return;
            if (absDy > absDx) return;

            const itemType = editorView.state.schema.nodes[state.itemTypeName];
            if (!itemType) return;

            // Move the cursor inside the touched item before running the
            // command — sinkListItem/liftListItem operate on the selection's
            // current list item, not on a position we hand them.
            const $inside = editorView.state.doc.resolve(state.itemPos + 1);
            const sel = TextSelection.near($inside);
            editorView.dispatch(editorView.state.tr.setSelection(sel));

            const command = dx > 0 ? sinkListItem : liftListItem;
            command(itemType)(editorView.state, editorView.dispatch);
            editorView.focus();
          };

          dom.addEventListener("touchstart", onTouchStart, { passive: true });
          dom.addEventListener("touchmove", onTouchMove, { passive: false });
          dom.addEventListener("touchend", onTouchEnd, { passive: true });
          dom.addEventListener("touchcancel", reset, { passive: true });

          return {
            destroy() {
              dom.removeEventListener("touchstart", onTouchStart);
              dom.removeEventListener("touchmove", onTouchMove);
              dom.removeEventListener("touchend", onTouchEnd);
              dom.removeEventListener("touchcancel", reset);
            },
          };
        },
      }),
    ];
  },
});
