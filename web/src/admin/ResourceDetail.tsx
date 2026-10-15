import {changeDays} from '@booking/core/admin/change';
import {limitText, slotsText} from '@booking/core/admin/schedule';
import type {AdminResource, AdminResources} from '@booking/core/api/types';
import {localize} from '@booking/core/i18n/catalog';
import {formatDayMonth} from '@booking/core/lib/dates';
import {useState} from 'react';

import {ActionRow} from '@/admin/Rows';
import {CARD, SECONDARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {useAdminActions} from '@/hooks/useAdminActions';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

type ResourceDetailProps = {
  resource: AdminResource;
  data: AdminResources;
  // After every change, and after a failure that means the resource shown
  // is out of date.
  onChanged: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  onClose: () => void;
  // After the resource is removed, which leaves nothing to show.
  onRemoved: () => void;
};

export function ResourceDetail({
  resource,
  data,
  onChanged,
  onEdit,
  onSchedule,
  onClose,
  onRemoved,
}: ResourceDetailProps) {
  const t = useMessages();
  const {locale} = useLocale();
  const tags = localize(resource.tags, locale) ?? [];
  const note = localize(resource.closingNote, locale);
  const {kinds, today} = data;
  const kind = kinds.find((item) => item.id === resource.kindId);
  const [current, ...later] = resource.schedules;
  const closed = resource.closesFrom !== null && resource.closesFrom <= today;

  const [busy, setBusy] = useState(false);
  const actions = useAdminActions(onChanged, setBusy);

  // Members see the resources grouped by kind, so a move swaps places with
  // the neighbour of the same kind.
  const siblings = data.resources.filter(
    (item) => item.kindId === resource.kindId,
  );
  const position = siblings.findIndex((item) => item.id === resource.id);

  return (
    <div className='flex flex-col gap-6.5'>
      <section>
        <h2 className={SECTION_LABEL}>{t.admin.resource.times}</h2>
        <div
          className={`${CARD} flex flex-col divide-y divide-theme-line py-1.5`}
        >
          <div className='flex flex-col gap-0.5 py-2.5'>
            <span className='text-[13px] text-theme-muted'>
              {t.admin.resource.now}
            </span>
            <span className='text-sm tabular-nums text-theme-ink'>
              {current ? slotsText(current.slots) : t.admin.resources.noSlots}
            </span>
          </div>
          {later.map((schedule) => (
            <div
              key={schedule.validFrom}
              className='flex items-center justify-between gap-4 py-2.5'
            >
              <span className='flex flex-col gap-0.5'>
                <span className='text-[13px] text-theme-accent'>
                  {t.admin.resource.from(formatDayMonth(schedule.validFrom, t))}
                </span>
                <span className='text-sm tabular-nums text-theme-ink'>
                  {slotsText(schedule.slots)}
                </span>
              </span>
              {schedule.validFrom > today ? (
                <button
                  type='button'
                  onClick={() =>
                    void actions.resources.confirmRemoveChange(
                      resource.id,
                      schedule.validFrom,
                    )
                  }
                  className='shrink-0 text-[13px] font-semibold text-theme-muted transition-colors hover:text-theme-ink'
                >
                  {t.admin.remove}
                </button>
              ) : null}
            </div>
          ))}
          {resource.closesFrom ? (
            <div className='flex flex-col gap-0.5 py-2.5'>
              <span className='text-[13px] text-theme-accent'>
                {closed
                  ? t.admin.resource.closedSince(
                      formatDayMonth(resource.closesFrom, t),
                    )
                  : t.rules.closes(formatDayMonth(resource.closesFrom, t))}
              </span>
              {note ? (
                <span className='text-sm text-theme-ink'>{note}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      <section>
        <h2 className={SECTION_LABEL}>{t.admin.details}</h2>
        <div
          className={`${CARD} flex flex-col divide-y divide-theme-line py-1.5`}
        >
          <div className='flex items-baseline justify-between gap-4 py-2.5'>
            <span className='text-[13px] text-theme-muted'>
              {t.admin.resource.kind}
            </span>
            <span className='text-right text-sm text-theme-ink'>
              {kind
                ? `${localize(kind.name, locale)} · ${limitText(kind, t)}`
                : '–'}
            </span>
          </div>
          <div className='flex items-baseline justify-between gap-4 py-2.5'>
            <span className='text-[13px] text-theme-muted'>
              {t.admin.resource.tags}
            </span>
            <span className='text-right text-sm text-theme-ink'>
              {tags.length > 0 ? tags.join(', ') : '–'}
            </span>
          </div>
        </div>
      </section>
      <section>
        <h2 className={SECTION_LABEL}>{t.admin.actions}</h2>
        <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
          <ActionRow
            label={t.admin.resource.editTimes}
            description={t.admin.resource.editTimesHint(
              formatDayMonth(
                changeDays('schedule', today, resource.freeFrom).free,
                t,
              ),
            )}
            onPress={onSchedule}
          />
          <ActionRow
            label={t.admin.editDetails}
            description={t.admin.resource.editDetailsHint}
            onPress={onEdit}
          />
          {resource.closesFrom ? null : (
            <ActionRow
              label={t.admin.resource.close}
              description={t.admin.resource.closeHint}
              onPress={onClose}
            />
          )}
        </div>
      </section>
      <div className='flex flex-wrap gap-2.5'>
        {siblings.length > 1 ? (
          <>
            <button
              type='button'
              onClick={() =>
                actions.resources.move(data.resources, resource, -1)
              }
              disabled={busy || position === 0}
              className={SECONDARY_BUTTON}
            >
              {t.admin.resource.moveUp}
            </button>
            <button
              type='button'
              onClick={() =>
                actions.resources.move(data.resources, resource, 1)
              }
              disabled={busy || position === siblings.length - 1}
              className={SECONDARY_BUTTON}
            >
              {t.admin.resource.moveDown}
            </button>
          </>
        ) : null}
        {resource.closesFrom ? (
          <button
            type='button'
            onClick={() => void actions.resources.reopen(resource.id, closed)}
            disabled={busy}
            className={SECONDARY_BUTTON}
          >
            {closed ? t.admin.resource.reopen : t.admin.resource.undoClose}
          </button>
        ) : null}
        {closed ? (
          <button
            type='button'
            onClick={() =>
              actions.resources.confirmRemove(
                resource.id,
                localize(resource.name, locale) ?? '',
                onRemoved,
              )
            }
            disabled={busy}
            className={SECONDARY_BUTTON}
          >
            {t.admin.resource.remove}
          </button>
        ) : null}
      </div>
      {resource.closesFrom && !closed ? (
        <p className='-mt-4 text-[13px] leading-5 text-theme-muted'>
          {t.admin.resource.removableFrom(
            formatDayMonth(resource.closesFrom, t),
          )}
        </p>
      ) : null}
    </div>
  );
}
