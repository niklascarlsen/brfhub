import {nextSlot} from '@booking/core/admin/schedule';
import type {SlotInput} from '@booking/core/api/types';

import {SECONDARY_BUTTON} from '@/admin/styles';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {AddIcon} from '@/components/icons';
import {useMessages} from '@/i18n/LocaleProvider';

type SlotsEditorProps = {
  slots: SlotInput[];
  onChange: (slots: SlotInput[]) => void;
};

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
          className='flex flex-col gap-3 rounded-2xl border border-theme-line bg-theme-surface px-3.5 py-3'
        >
          <div className='grid grid-cols-2 gap-2.5'>
            <FloatingLabelInput
              label={t.admin.slots.starts}
              type='time'
              required
              value={slot.start}
              onChange={(event) => update(index, {start: event.target.value})}
            />
            <FloatingLabelInput
              label={t.admin.slots.ends}
              type='time'
              required
              value={slot.end}
              onChange={(event) => update(index, {end: event.target.value})}
            />
          </div>
          <div className='flex items-center justify-between gap-3'>
            <label className='flex min-h-8 items-center gap-2.5 text-[13px] text-theme-ink'>
              <input
                type='checkbox'
                checked={slot.endOffsetDays === 1}
                onChange={(event) =>
                  update(index, {endOffsetDays: event.target.checked ? 1 : 0})
                }
                className='h-4.5 w-4.5 accent-theme-ink'
              />
              {t.admin.slots.endsNextDay}
            </label>
            <button
              type='button'
              onClick={() => onChange(slots.filter((_, at) => at !== index))}
              disabled={slots.length === 1}
              className='rounded-full px-2 py-1 text-[13px] font-semibold text-theme-muted transition-colors hover:text-theme-ink disabled:opacity-35'
            >
              {t.admin.remove}
            </button>
          </div>
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
