import {type ComponentProps} from 'react';

type FloatingLabelInputProps = ComponentProps<'input'> & {
  label: string;
};

const FIELD =
  'peer h-13 w-full rounded-xs border border-theme-edge bg-theme-surface px-4 pt-6 pb-2 text-base text-theme-ink placeholder:text-transparent focus:border-theme-ink';

const LABEL =
  'pointer-events-none absolute left-4 top-2 text-[13px] font-medium leading-none text-theme-muted transition-all duration-150 ease-out peer-placeholder-shown:peer-not-focus:top-4.5 peer-placeholder-shown:peer-not-focus:text-base peer-placeholder-shown:peer-not-focus:text-theme-faint';

export function FloatingLabelInput({
  label,
  className,
  ...props
}: FloatingLabelInputProps) {
  return (
    <label className={`relative block ${className ?? ''}`}>
      <input className={FIELD} {...props} placeholder=' ' />
      <span className={LABEL}>{label}</span>
    </label>
  );
}
