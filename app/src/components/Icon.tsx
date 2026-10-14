import Ionicons from '@expo/vector-icons/Ionicons';
import type {ComponentProps} from 'react';

// An Ionicons glyph, hidden from screen readers: read aloud it is a private
// character, and the text beside it already says what it means. A control
// with an icon alone names itself with accessibilityLabel. The web's icons
// are aria-hidden the same way.
export function Icon(props: ComponentProps<typeof Ionicons>) {
  return (
    <Ionicons
      {...props}
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
    />
  );
}
