import type {SlotInput} from '@/api/client';
import {SECONDARY_BUTTON} from '@/admin/styles';
import {nextSlot} from '@/admin/schedule';
import {AddIcon} from '@/components/icons';
import {useMessages} from '@/i18n/LocaleProvider';

type SlotsEditorProps = {
  slots: SlotInput[];
  onChange: (slots: SlotInput[]) => void;
};

const TIME_FIELD =
  'h-11 w-full rounded-xs border border-theme-edge bg-theme-surface px-3 text-base tabular-nums text-theme-ink focus:border-theme-ink';

export function SlotsEditor({slots, onChange}: SlotsEditorProps) {
  const t = useMessages();
  const update = (index: number, change: Partial<SlotInput>) =>
    onChange(
      slots.map((slot, at) => (at === index ? {...slot, ...change} : slot)),
    );

  return (
    <div className='flex flex-col gap-2.5'>
      {slots.map((slot, index) => (
        <div
          key={index}
          className='flex flex-wrap items-end gap-2.5 rounded-2xl border border-theme-line bg-theme-surface px-3.5 py-3'
        >
          <label className='flex min-w-24 flex-1 flex-col gap-1'>
            <span className='text-xs font-medium text-theme-muted'>
              {t.admin.slots.starts}
            </span>
            <input
              type='time'
              required
              value={slot.start}
              onChange={(event) => update(index, {start: event.target.value})}
              className={TIME_FIELD}
            />
          </label>
          <label className='flex min-w-24 flex-1 flex-col gap-1'>
            <span className='text-xs font-medium text-theme-muted'>
              {t.admin.slots.ends}
            </span>
            <input
              type='time'
              required
              value={slot.end}
              onChange={(event) => update(index, {end: event.target.value})}
              className={TIME_FIELD}
            />
          </label>
          <label className='flex h-11 items-center gap-2 text-[13px] text-theme-ink'>
            <input
              type='checkbox'
              checked={slot.endOffsetDays === 1}
              onChange={(event) =>
                update(index, {endOffsetDays: event.target.checked ? 1 : 0})
              }
              className='h-4.5 w-4.5 accent-theme-ink'
            />
            {t.admin.slots.nextDay}
          </label>
          <button
            type='button'
            onClick={() => onChange(slots.filter((_, at) => at !== index))}
            disabled={slots.length === 1}
            className='h-11 rounded-full px-3 text-[13px] font-semibold text-theme-muted transition-colors hover:text-theme-ink disabled:opacity-35'
          >
            {t.admin.remove}
          </button>
        </div>
      ))}
      <button
        type='button'
        onClick={() => onChange([...slots, nextSlot(slots)])}
        disabled={slots.length >= 24}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        <AddIcon size={18} />
        {t.admin.slots.add}
      </button>
    </div>
  );
}
