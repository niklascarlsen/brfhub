import {useRef} from 'react';

// How far the mouse moves before a press counts as a drag, not a click.
const DRAG_THRESHOLD = 5;

// Lets a mouse drag a horizontally scrolling row, which touch and a
// trackpad already scroll. A drag ends without the click it would
// otherwise fire on an item.
export function useDragScroll() {
  const drag = useRef<{x: number; scrollLeft: number} | null>(null);
  const dragged = useRef(false);

  return {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      dragged.current = false;
      if (event.pointerType === 'mouse' && event.button === 0) {
        drag.current = {
          x: event.clientX,
          scrollLeft: event.currentTarget.scrollLeft,
        };
      }
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      if (!drag.current) {
        return;
      }

      // Released outside the window, where the row never heard it. Chromium
      // also moves without buttons just before a release, so this ends the
      // drag but keeps it a drag, and its click is still swallowed.
      if (event.buttons === 0) {
        drag.current = null;
        return;
      }

      const distance = event.clientX - drag.current.x;
      if (!dragged.current && Math.abs(distance) >= DRAG_THRESHOLD) {
        dragged.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      if (dragged.current) {
        event.currentTarget.scrollLeft = drag.current.scrollLeft - distance;
      }
    },
    onPointerUp() {
      drag.current = null;
    },
    onPointerCancel() {
      drag.current = null;
    },
    // Keeps the browser from dragging the text or the button itself instead
    // of the row, which would end in a click on release.
    onDragStart(event: React.DragEvent) {
      event.preventDefault();
    },
    // A click from the keyboard has no detail, so only the mouse's click
    // that ends a drag is swallowed.
    onClickCapture(event: React.MouseEvent) {
      if (dragged.current && event.detail > 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
