// Every colour and radius of both clients, in one place. The app
// reads it here and through tailwind.config.js (`bg-theme-<name>`,
// `rounded-card`), the web through src/theme.css, which `npm run generate`
// in web/ writes from it. Components use these names and never a colour of
// their own, nor a colour made fainter with an opacity: a new shade is a
// new name here.
//
// The palette is warm: a beige page, white cards, ink text, and one green
// for what is good or chosen. Red is for errors and what is given up. A
// value with two more hex digits is that colour with an alpha.

export const theme = {
  // The page behind everything.
  bg: '#F7F5F1',
  // Cards, inputs, buttons and dialogs on the page.
  surface: '#FFFFFF',
  // Quiet surfaces: hovered and pressed rows, closed and taken times,
  // notices, and the tab bar's active lens.
  sunk: '#F2EFE9',
  // A disabled button, a fully booked day in the desktop calendar.
  track: '#EAE6DE',
  // Card outlines and dividers.
  line: '#E8E4DC',
  // Outlines of buttons and inputs, a step stronger than line.
  edge: '#DAD5CB',

  // Text, from quietest to strongest.
  faint: '#A19B90',
  muted: '#77726A',
  ink: '#14130F',

  // The green: badges, "free now", the time gained in a dialog, links.
  accent: '#4E6553',
  // Its light ground: badges, announcements, the time gained in a dialog.
  mist: '#ECF0EA',
  // An announcement's outline, and the ones waiting behind it.
  'mist-line': '#D9E1D5',

  // Errors, cancelling and the time given up in a dialog.
  danger: '#A8452F',
  // The time given up in a dialog.
  'danger-tint': '#A8452F14',
  // A pressed or hovered destructive choice in a dialog.
  'danger-wash': '#A8452F0D',
  // Its outline on hover, on the web.
  'danger-line': '#A8452F66',
  // A count of problems on an admin row.
  'danger-badge': '#A8452F1A',

  // Dimming behind a dialog or a sheet.
  scrim: '#14130F4D',

  // The floating tab bar; its active lens is sunk.
  // Its outline and shadow, which set it apart from a white card passing
  // under it.
  'bar-line': '#14130F14',
  'bar-shadow': '#14130F1F',
  // Its surface on Android, which has no glass.
  'bar-surface': '#FFFFFFFA',
  // The white veil over Liquid Glass on iOS.
  'bar-veil': '#FFFFFF59',
  // Its frosted surface on the web, over a blur.
  'bar-glass': '#FFFFFFB8',

  // The page fading into bg: under the tab bar from clear to deep, and
  // under the booking page's fixed pickers by veil.
  'fade-clear': '#F7F5F100',
  'fade-veil': '#F7F5F166',
  'fade-mid': '#F7F5F1D9',
  'fade-deep': '#F7F5F1F2',
};

export const radius = {
  // Every card, dialog and the tab bar.
  card: 20,
  // What sits 6px inside a card, such as the tab bar's lens.
  'card-inner': 14,
};
