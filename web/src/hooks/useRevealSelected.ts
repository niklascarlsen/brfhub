import {useEffect, useRef} from 'react';

// Keeps the selected item of a horizontally scrolling row fully in view,
// scrolling as little as possible. A notification can select an item that
// is off screen.
// The row marks its selected item with aria-pressed and sets scroll-padding
// for the gutter.
export function useRevealSelected(selectedKey: string) {
  const scroller = useRef<HTMLDivElement>(null);

  // Wait for the web font, or the items are measured at the fallback width.
  useEffect(() => {
    void document.fonts.ready.then(() =>
      scroller.current
        ?.querySelector('[aria-pressed="true"]')
        ?.scrollIntoView({block: 'nearest', inline: 'nearest'}),
    );
  }, [selectedKey]);

  return scroller;
}
