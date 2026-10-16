import {codeOf, errorMessage} from '../api/errors';
import type {LocalizedTags, LocalizedText, SlotInput} from '../api/types';
import {limits} from '../generated/limits';
import type {Locale, Messages} from '../i18n/catalog';
import {tagsOf, trimmedText, type Draft} from './localized';
import {slotsProblem} from './schedule';

// What is wrong with a field. A limit broken is said at once, as the admin
// types. Something still missing waits until the field has been left or a
// save tried, so a form is not marked all over before it is filled in.
export type Problem = {message: string; missing: boolean};

export type Problems<F extends string> = Partial<Record<F, Problem>>;

// A form's draft, read against what was saved.
export type Checked<T, F extends string> = {
  // What a save sends: trimmed, and in the organization's languages.
  value: T;
  // Differs from what was saved, so it can be saved and is not left
  // without asking.
  changed: boolean;
  problems: Problems<F>;
};

type TextLimit = {readonly minLength?: number; readonly maxLength?: number};

// A field written once per language, such as title.sv.
type PerLocale<F extends string> = `${F}.${Locale}`;

export function hasProblems(problems: Problems<string>): boolean {
  return Object.values(problems).some((problem) => problem !== undefined);
}

// The message a field shows, given whether it has been left or a save
// tried.
export function shownProblem(
  problem: Problem | undefined,
  left: boolean,
): string | null {
  if (problem === undefined || (problem.missing && !left)) {
    return null;
  }

  return problem.message;
}

// The same content, whatever the order of an object's keys. A key that is
// undefined counts as absent, as it does once sent.
export function isSame(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => isSame(item, b[index]))
    );
  }

  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
    return false;
  }

  const defined = (value: object) =>
    Object.entries(value).filter(([, item]) => item !== undefined);
  const left = defined(a);
  const right = new Map(defined(b));

  return (
    left.length === right.size &&
    left.every(([key, item]) => isSame(item, right.get(key)))
  );
}

// Lengths count what is sent, which is trimmed.
function textProblem(
  text: string,
  {minLength = 0, maxLength}: TextLimit,
  t: Messages,
): Problem | undefined {
  const length = text.trim().length;

  if (maxLength !== undefined && length > maxLength) {
    return {message: t.admin.field.tooLong(length, maxLength), missing: false};
  }

  if (length < minLength) {
    return {message: t.admin.field.required, missing: true};
  }

  return undefined;
}

function isWritten(text: string | undefined): boolean {
  return (text ?? '').trim().length > 0;
}

// Text written once per language. Text that may be left out is written in
// every language or in none, which a language left empty is told.
function localizedProblems<F extends string>(
  field: F,
  draft: Draft,
  locales: readonly Locale[],
  check: (text: string) => Problem | undefined,
  everyOrNone?: string,
): Problems<PerLocale<F>> {
  const someWritten = locales.some((locale) => isWritten(draft[locale]));
  const problems: Problems<PerLocale<F>> = {};

  for (const locale of locales) {
    const text = draft[locale] ?? '';
    const problem =
      check(text) ??
      (everyOrNone && someWritten && !isWritten(text)
        ? {message: everyOrNone, missing: true}
        : undefined);

    if (problem) {
      problems[`${field}.${locale}`] = problem;
    }
  }

  return problems;
}

// A server that refuses what the form allowed is told plainly, with what
// the form asks the admin to check.
export function failureMessage(
  error: unknown,
  t: Messages,
  rejected: string = t.admin.field.rejected,
): string {
  const code = codeOf(error);

  return code === 'VALIDATION' ? rejected : errorMessage(code, t);
}

export type ApartmentFields = {
  label: string;
  residentName: string;
  email: string;
};

// A new resident keeps the apartment's number, so withLabel is false.
export function checkApartment(
  draft: ApartmentFields,
  saved: ApartmentFields,
  withLabel: boolean,
  t: Messages,
): Checked<ApartmentFields, keyof ApartmentFields> {
  const value = {
    label: draft.label.trim(),
    residentName: draft.residentName.trim(),
    email: draft.email.trim(),
  };
  const rules = limits.CreateApartmentBody;

  return {
    value,
    changed: !isSame(value, saved),
    problems: {
      label: withLabel ? textProblem(value.label, rules.label, t) : undefined,
      residentName: textProblem(value.residentName, rules.residentName, t),
      // The server checks the address itself, as it is sent.
      email: textProblem(value.email, {minLength: 1}, t),
    },
  };
}

export type AdminFields = {name: string; email: string};

export function checkAdmin(
  draft: AdminFields,
  t: Messages,
): Checked<AdminFields, keyof AdminFields> {
  const value = {name: draft.name.trim(), email: draft.email.trim()};

  return {
    value,
    changed: value.name.length > 0 || value.email.length > 0,
    problems: {
      name: textProblem(value.name, limits.AddAdminBody.name, t),
      // The server checks the address itself, as it is sent.
      email: textProblem(value.email, {minLength: 1}, t),
    },
  };
}

export type AnnouncementFields = {
  title: LocalizedText;
  body: LocalizedText;
  endsOn: string | null;
};

export function checkAnnouncement(
  draft: {title: Draft; body: Draft; endsOn: string | null},
  saved: AnnouncementFields,
  locales: readonly Locale[],
  t: Messages,
): Checked<AnnouncementFields, PerLocale<'title' | 'body'>> {
  const value = {
    title: trimmedText(draft.title, locales),
    body: trimmedText(draft.body, locales),
    endsOn: draft.endsOn,
  };
  const rules = limits.AnnouncementBody;

  return {
    value,
    changed: !isSame(value, {
      title: trimmedText(saved.title, locales),
      body: trimmedText(saved.body, locales),
      endsOn: saved.endsOn,
    }),
    problems: {
      ...localizedProblems('title', draft.title, locales, (text) =>
        textProblem(text, rules.title, t),
      ),
      ...localizedProblems('body', draft.body, locales, (text) =>
        textProblem(text, rules.body, t),
      ),
    },
  };
}

export type KindFields = {name: LocalizedText; maxActive: number};

export function checkKind(
  draft: {name: Draft; maxActive: number},
  saved: KindFields,
  locales: readonly Locale[],
  t: Messages,
): Checked<KindFields, PerLocale<'name'>> {
  const value = {
    name: trimmedText(draft.name, locales),
    maxActive: draft.maxActive,
  };

  return {
    value,
    changed: !isSame(value, {
      name: trimmedText(saved.name, locales),
      maxActive: saved.maxActive,
    }),
    problems: localizedProblems('name', draft.name, locales, (text) =>
      textProblem(text, limits.CreateKindBody.name, t),
    ),
  };
}

// The stepper for a kind's limit stays inside what the server takes.
export function stepMaxActive(maxActive: number, by: number): number {
  const {minimum, maximum} = limits.CreateKindBody.maxActive;

  return Math.min(maximum, Math.max(minimum, maxActive + by));
}

export type ResourceFields = {
  name: LocalizedText;
  kindId: string;
  tags: LocalizedTags;
  slots: SlotInput[];
};

// Tags are edited as one line per language, separated by commas.
export function tagsText(tags: LocalizedTags): Draft {
  return Object.fromEntries(
    Object.entries(tags).map(([locale, list]) => [locale, list.join(', ')]),
  );
}

function tagsProblem(text: string, t: Messages): Problem | undefined {
  const tags = tagsOf(text);
  const {maxItems, items} = limits.CreateResourceBody.tags;

  if (tags.length > maxItems) {
    return {message: t.admin.field.tooManyTags(maxItems), missing: false};
  }

  if (tags.some((tag) => tag.length > items.maxLength)) {
    return {
      message: t.admin.field.tagTooLong(items.maxLength),
      missing: false,
    };
  }

  return undefined;
}

// A new resource sets its first times in the same form; a resource that is
// edited changes its times through the schedule instead.
export function checkResource(
  draft: {name: Draft; kindId: string; tags: Draft; slots: SlotInput[]},
  saved: ResourceFields,
  {locales, withSlots}: {locales: readonly Locale[]; withSlots: boolean},
  t: Messages,
): Checked<ResourceFields, PerLocale<'name' | 'tags'> | 'kindId' | 'slots'> {
  const value = {
    name: trimmedText(draft.name, locales),
    kindId: draft.kindId,
    tags: Object.fromEntries(
      locales.map((locale) => [locale, tagsOf(draft.tags[locale] ?? '')]),
    ),
    slots: draft.slots,
  };
  const slots = withSlots ? slotsProblem(draft.slots, t) : null;

  return {
    value,
    changed: !isSame(value, {
      name: trimmedText(saved.name, locales),
      kindId: saved.kindId,
      tags: Object.fromEntries(
        locales.map((locale) => [locale, saved.tags[locale] ?? []]),
      ),
      slots: saved.slots,
    }),
    problems: {
      ...localizedProblems('name', draft.name, locales, (text) =>
        textProblem(text, limits.CreateResourceBody.name, t),
      ),
      ...localizedProblems(
        'tags',
        draft.tags,
        locales,
        (text) => tagsProblem(text, t),
        t.admin.localized.tagsInEvery,
      ),
      kindId: textProblem(draft.kindId, limits.CreateResourceBody.kindId, t),
      slots: slots === null ? undefined : {message: slots, missing: true},
    },
  };
}

// New times, with the message to the apartments whose bookings they
// cancel, written in every language or in none.
export type ScheduleChange = {slots: SlotInput[]; reason: Draft};

function reasonProblems(
  draft: Draft,
  locales: readonly Locale[],
  t: Messages,
): Problems<PerLocale<'reason'>> {
  return localizedProblems(
    'reason',
    draft,
    locales,
    (text) => textProblem(text, limits.ClosingBody.reason, t),
    t.admin.localized.reasonInEvery,
  );
}

export function checkSchedule(
  draft: ScheduleChange,
  saved: SlotInput[],
  locales: readonly Locale[],
  t: Messages,
): Checked<ScheduleChange, 'slots' | PerLocale<'reason'>> {
  const problem = slotsProblem(draft.slots, t);

  return {
    value: {slots: draft.slots, reason: trimmedText(draft.reason, locales)},
    changed: !isSame(draft.slots, saved),
    problems: {
      slots: problem === null ? undefined : {message: problem, missing: true},
      ...reasonProblems(draft.reason, locales, t),
    },
  };
}

// A closing has nothing saved to compare with: it can always be sent. Its
// message stays with the closed resource for everyone to read.
export function checkClosing(
  draft: {reason: Draft},
  locales: readonly Locale[],
  t: Messages,
): Checked<{reason: Draft}, PerLocale<'reason'>> {
  return {
    value: {reason: trimmedText(draft.reason, locales)},
    changed: true,
    problems: reasonProblems(draft.reason, locales, t),
  };
}

export function canAddSlot(slots: SlotInput[]): boolean {
  return slots.length < limits.PutScheduleBody.slots.maxItems;
}

export type DetailsFields = {name: string; bookingWindowDays: number};

// The days are typed as text, and 030 is the same 30 days.
export function checkDetails(
  draft: {name: string; days: string},
  saved: DetailsFields,
  t: Messages,
): Checked<DetailsFields, 'name' | 'days'> {
  const value = {
    name: draft.name.trim(),
    bookingWindowDays: Number(draft.days),
  };
  const rules = limits.UpdateOrganizationBody;
  const {minimum, maximum} = rules.bookingWindowDays;
  const days = value.bookingWindowDays;

  let daysProblem: Problem | undefined;
  if (draft.days.trim() === '') {
    daysProblem = {message: t.admin.field.required, missing: true};
  } else if (!Number.isInteger(days) || days < minimum || days > maximum) {
    daysProblem = {
      message: t.admin.organization.windowRange(minimum, maximum),
      missing: false,
    };
  }

  return {
    value,
    changed: !isSame(value, saved),
    problems: {
      name: textProblem(value.name, rules.name, t),
      days: daysProblem,
    },
  };
}

// The rules may be left out, in every language at once.
export function checkRules(
  draft: Draft,
  saved: Draft,
  locales: readonly Locale[],
  t: Messages,
): Checked<LocalizedText, PerLocale<'rules'>> {
  const value = trimmedText(draft, locales);

  return {
    value,
    changed: !isSame(value, trimmedText(saved, locales)),
    problems: localizedProblems(
      'rules',
      draft,
      locales,
      (text) => textProblem(text, limits.UpdateOrganizationBody.rulesText, t),
      t.admin.localized.rulesInEvery,
    ),
  };
}

export type PasswordFields = {current: string; next: string; repeat: string};

// A password is sent as typed, spaces and all.
export function checkPassword(
  draft: PasswordFields,
  t: Messages,
): Checked<PasswordFields, keyof PasswordFields> {
  const {minLength, maxLength} = limits.ChangePasswordBody.newPassword;
  const required = {message: t.admin.field.required, missing: true};

  let next: Problem | undefined;
  if (draft.next.length > maxLength) {
    next = {
      message: t.admin.organization.passwordTooLong(maxLength),
      missing: false,
    };
  } else if (draft.next.length < minLength) {
    next = {
      message: t.admin.organization.passwordTooShort(minLength),
      missing: true,
    };
  }

  let repeat: Problem | undefined;
  if (draft.repeat.length === 0) {
    repeat = required;
  } else if (draft.repeat !== draft.next) {
    repeat = {message: t.admin.organization.passwordsDiffer, missing: true};
  }

  return {
    value: draft,
    changed: Object.values(draft).some((field) => field.length > 0),
    problems: {
      current: draft.current.length === 0 ? required : undefined,
      next,
      repeat,
    },
  };
}

// A new password set with a mailed code, by an admin who is not signed in.
export type PasswordResetFields = {code: string; next: string; repeat: string};

export function checkPasswordReset(
  draft: PasswordResetFields,
  t: Messages,
): Checked<PasswordResetFields, keyof PasswordResetFields> {
  const {problems} = checkPassword({current: draft.code, ...draft}, t);

  return {
    value: {...draft, code: draft.code.trim()},
    changed: Object.values(draft).some((field) => field.length > 0),
    problems: {
      code: problems.current,
      next: problems.next,
      repeat: problems.repeat,
    },
  };
}
