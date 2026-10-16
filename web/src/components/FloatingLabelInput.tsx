import {useId, useState, type ComponentProps} from 'react';

import {FieldProblem} from '@/components/FieldProblem';
import {EyeOffOutlineIcon, EyeOutlineIcon} from '@/components/icons';
import {useMessages} from '@/i18n/LocaleProvider';

type FloatingLabelInputProps = ComponentProps<'input'> & {
  label: string;
  // What is wrong with what is typed, said under the field.
  problem?: string | null;
};

const FIELD =
  'peer h-13 w-full rounded-xs border bg-theme-surface pt-6.5 pb-1.5 pl-4 text-base text-theme-ink placeholder:text-transparent [&::-webkit-date-and-time-value]:text-left';

// A long label is cut short rather than wrapped onto a second line, where
// it would run into what is typed. Cutting it short clips to the line box,
// so each line is tall enough for the descenders of a g or a p.
const LABEL =
  'pointer-events-none absolute left-4 top-[4.5px] truncate text-[13px] font-medium leading-4.5 text-theme-muted transition-all duration-150 ease-out peer-placeholder-shown:peer-not-focus:top-4 peer-placeholder-shown:peer-not-focus:text-[15px] peer-placeholder-shown:peer-not-focus:leading-5 peer-placeholder-shown:peer-not-focus:text-theme-faint';

export function FloatingLabelInput({
  label,
  className,
  type,
  problem,
  ...props
}: FloatingLabelInputProps) {
  const t = useMessages();
  const problemId = useId();
  // A password can be shown while it is typed, to check all of it.
  const [revealed, setRevealed] = useState(false);
  const secret = type === 'password';

  // The field keeps its place in the tree whether or not a problem shows,
  // so it never loses focus while one comes and goes.
  return (
    <div className={className}>
      <label className='relative block'>
        <input
          className={`${FIELD} ${secret ? 'pr-11' : 'pr-4'} ${
            problem
              ? 'border-theme-danger'
              : 'border-theme-edge focus:border-theme-ink'
          }`}
          type={secret && revealed ? 'text' : type}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          {...props}
          placeholder=' '
        />
        <span className={`${LABEL} ${secret ? 'right-11' : 'right-4'}`}>
          {label}
        </span>
        {secret ? (
          <button
            type='button'
            onClick={() => setRevealed((previous) => !previous)}
            aria-label={
              revealed ? t.common.hidePassword : t.common.showPassword
            }
            aria-pressed={revealed}
            className='absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xs text-theme-muted transition-colors hover:text-theme-ink'
          >
            {revealed ? (
              <EyeOffOutlineIcon size={20} />
            ) : (
              <EyeOutlineIcon size={20} />
            )}
          </button>
        ) : null}
      </label>
      {problem ? <FieldProblem id={problemId} message={problem} /> : null}
    </div>
  );
}
