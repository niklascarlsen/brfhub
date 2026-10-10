import {useState, type ComponentProps} from 'react';

import {EyeOffOutlineIcon, EyeOutlineIcon} from '@/components/icons';
import {useMessages} from '@/i18n/LocaleProvider';

type FloatingLabelInputProps = ComponentProps<'input'> & {
  label: string;
};

const FIELD =
  'peer h-13 w-full rounded-xs border border-theme-edge bg-theme-surface pt-6 pb-2 pl-4 text-base text-theme-ink placeholder:text-transparent focus:border-theme-ink [&::-webkit-date-and-time-value]:text-left';

// A long label is cut short rather than wrapped onto a second line, where
// it would run into what is typed.
const LABEL =
  'pointer-events-none absolute left-4 top-2 truncate text-[13px] font-medium leading-none text-theme-muted transition-all duration-150 ease-out peer-placeholder-shown:peer-not-focus:top-4.5 peer-placeholder-shown:peer-not-focus:text-[15px] peer-placeholder-shown:peer-not-focus:leading-4 peer-placeholder-shown:peer-not-focus:text-theme-faint';

export function FloatingLabelInput({
  label,
  className,
  type,
  ...props
}: FloatingLabelInputProps) {
  const t = useMessages();
  // A password can be shown while it is typed, to check all of it.
  const [revealed, setRevealed] = useState(false);
  const secret = type === 'password';

  return (
    <label className={`relative block ${className ?? ''}`}>
      <input
        className={`${FIELD} ${secret ? 'pr-11' : 'pr-4'}`}
        type={secret && revealed ? 'text' : type}
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
          aria-label={revealed ? t.common.hidePassword : t.common.showPassword}
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
  );
}
