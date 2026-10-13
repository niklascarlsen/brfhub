import {useState} from 'react';

import {hasProblems, shownProblem, type Problems} from './drafts';

// Which of a form's problems may show: the fields left, and whether a
// save was tried while something was wrong.
export type Shown<F extends string> = {
  left: ReadonlySet<F>;
  tried: boolean;
};

export function nothingShown<F extends string>(): Shown<F> {
  return {left: new Set(), tried: false};
}

export function leaveField<F extends string>(
  shown: Shown<F>,
  field: F,
): Shown<F> {
  return shown.left.has(field)
    ? shown
    : {...shown, left: new Set(shown.left).add(field)};
}

// Something missing waits until the field has been left in a form that
// has changes, or a save was tried: leaving an empty field of a form not
// yet touched, such as an optional one, marks nothing.
export function problemShown<F extends string>(
  shown: Shown<F>,
  problems: Problems<F>,
  field: F,
  changed: boolean,
): string | null {
  return shownProblem(
    problems[field],
    shown.tried || (changed && shown.left.has(field)),
  );
}

// What a form shows of its problems: a limit broken at once, and something
// missing once its field has been left in a changed form. A save tried
// while something is wrong shows every problem instead of sending.
export function useProblems<F extends string>({
  problems,
  changed,
}: {
  problems: Problems<F>;
  changed: boolean;
}) {
  const [shown, setShown] = useState<Shown<F>>(nothingShown);

  return {
    problem: (field: F) => problemShown(shown, problems, field, changed),
    leave: (field: F) => setShown((previous) => leaveField(previous, field)),
    // Whether the form may be sent now.
    ready: () => {
      if (hasProblems(problems)) {
        setShown((previous) => ({...previous, tried: true}));
        return false;
      }

      return true;
    },
    // A form that empties its fields after a save starts over, so nothing
    // is marked until the admin edits it again.
    reset: () => setShown(nothingShown()),
  };
}
