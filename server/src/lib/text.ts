import {z} from 'zod';

// Control characters never belong in what someone typed: the C0 and C1
// controls, and the bidi controls (Unicode's Bidi_Control: the embeddings,
// overrides and isolates) that make text read other than it is written. A
// line of text has none at all; a text of several lines keeps its line
// breaks and tabs.
const CONTROL = /[\p{Cc}\p{Bidi_Control}]/u;
const LINE_BREAKS = /[\n\r\t]/g;
const TABS = /\t/g;

export type TextOptions = {multiline?: boolean};

export function isCleanText(value: string, multiline = false): boolean {
  return !CONTROL.test(multiline ? value.replace(LINE_BREAKS, '') : value);
}

// A tab pasted into a line of text, from a spreadsheet say, is a space:
// the forms let it through, so the server does not refuse it.
function tabsToSpaces(value: string, multiline?: boolean): string {
  return multiline ? value : value.replace(TABS, ' ');
}

// Text someone types, trimmed and never empty, up to the length the
// field allows.
export function textSchema(maxLength: number, options: TextOptions = {}) {
  return z
    .string()
    .overwrite((value) => tabsToSpaces(value, options.multiline))
    .trim()
    .min(1)
    .max(maxLength)
    .refine((value) => isCleanText(value, options.multiline), {
      message: 'Control characters are not allowed',
    });
}

// The same for text that may be left empty.
export function optionalTextSchema(
  maxLength: number,
  options: TextOptions = {},
) {
  return z
    .string()
    .overwrite((value) => tabsToSpaces(value, options.multiline))
    .trim()
    .max(maxLength)
    .refine((value) => isCleanText(value, options.multiline), {
      message: 'Control characters are not allowed',
    });
}
