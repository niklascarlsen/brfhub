import {useEffect, useRef} from 'react';
import type {LayoutChangeEvent, ScrollViewInstance} from 'react-native';

type Span = {x: number; width: number};

// Matches the px-5 the scrolling rows pad their content with.
const GUTTER = 20;

// Keeps the selected item of a horizontal ScrollView fully in view, scrolling
// as little as possible. A notification can select an item that is off
// screen.
export function useRevealSelected(selectedKey: string) {
  const scroller = useRef<ScrollViewInstance>(null);
  const items = useRef(new Map<string, Span>());
  const view = useRef({x: 0, width: 0});

  function reveal(animated: boolean) {
    const item = items.current.get(selectedKey);
    const {x, width} = view.current;
    if (!item || width === 0) {
      return;
    }

    const left = item.x - GUTTER;
    const right = item.x + item.width + GUTTER - width;
    if (x > left) {
      scroller.current?.scrollTo({x: left, animated});
    } else if (x < right) {
      scroller.current?.scrollTo({x: right, animated});
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => reveal(true), [selectedKey]);

  return {
    scrollProps: {
      ref: scroller,
      scrollEventThrottle: 16,
      onScroll: (event: {nativeEvent: {contentOffset: {x: number}}}) => {
        view.current.x = event.nativeEvent.contentOffset.x;
      },
      onLayout: (event: LayoutChangeEvent) => {
        view.current.width = event.nativeEvent.layout.width;
        reveal(false);
      },
    },
    // Items report where they sit, and the selected one scrolls into view
    // once it is first measured.
    itemLayout: (key: string) => (event: LayoutChangeEvent) => {
      const {x, width} = event.nativeEvent.layout;
      items.current.set(key, {x, width});
      if (key === selectedKey) {
        reveal(false);
      }
    },
  };
}
