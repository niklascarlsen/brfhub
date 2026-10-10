import {useState} from 'react';

import {ResourceForm} from '@/admin/ResourceForm';
import {ScheduleForm} from '@/admin/ScheduleForm';
import {limitText, slotsText} from '@/admin/schedule';
import {CARD, SECONDARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {
  api,
  unwrap,
  type AdminResource,
  type AdminResources,
} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {useDialog} from '@/components/Dialog';
import {ChevronForwardIcon} from '@/components/icons';
import {useMessages} from '@/i18n/LocaleProvider';
import {formatDayMonth, formatLongDate} from '@/lib/dates';

type ResourceDetailProps = {
  resource: AdminResource;
  data: AdminResources;
  onChanged: () => void;
};

type Mode = 'view' | 'edit' | 'schedule';

function Action({
  label,
  description,
  onPress,
}: {
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onPress}
      className='flex w-full items-center gap-3 px-4.5 py-3.5 text-left transition-colors hover:bg-theme-sunk'
    >
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='text-[15px] font-semibold tracking-tight text-theme-ink'>
          {label}
        </span>
        <span className='text-[13px] leading-5 text-theme-muted'>
          {description}
        </span>
      </span>
      <ChevronForwardIcon size={16} className='shrink-0 text-theme-faint' />
    </button>
  );
}

export function ResourceDetail({
  resource,
  data,
  onChanged,
}: ResourceDetailProps) {
  const dialog = useDialog();
  const t = useMessages();
  const [mode, setMode] = useState<Mode>('view');
  const {kinds, earliestChange, today} = data;
  const kind = kinds.find((item) => item.id === resource.kindId);
  const [current, ...later] = resource.schedules;
  const latest = resource.schedules.at(-1);
  const closed = resource.closesFrom !== null && resource.closesFrom <= today;

  const fail = (title: string) => (caught: unknown) =>
    dialog.alert(title, errorMessage(codeOf(caught), t));

  const [busy, setBusy] = useState(false);

  const run = (request: () => Promise<unknown>, failTitle: string) => {
    if (busy) {
      return;
    }

    setBusy(true);
    request()
      .then(onChanged)
      .catch(fail(failTitle))
      .finally(() => setBusy(false));
  };

  // Members see the resources grouped by kind, so a move swaps places with
  // the neighbour of the same kind.
  const siblings = data.resources.filter(
    (item) => item.kindId === resource.kindId,
  );
  const position = siblings.findIndex((item) => item.id === resource.id);

  const move = (by: number) => {
    const neighbour = siblings[position + by];

    if (!neighbour) {
      return;
    }

    const ids = data.resources.map((item) =>
      item.id === resource.id
        ? neighbour.id
        : item.id === neighbour.id
          ? resource.id
          : item.id,
    );
    run(
      () => unwrap(api.PUT('/admin/resources/order', {body: {ids}})),
      t.admin.resource.moveFailed,
    );
  };

  const removeChange = (validFrom: string) =>
    dialog.confirm(
      t.admin.resource.removeChange,
      t.admin.resource.removeChangeQuestion(formatLongDate(validFrom, t)),
      {
        label: t.admin.remove,
        onPress: () => {
          run(
            () =>
              unwrap(
                api.DELETE('/admin/resources/{id}/schedule/{validFrom}', {
                  params: {path: {id: resource.id, validFrom}},
                }),
              ),
            t.admin.resource.removeChangeFailed,
          );
        },
      },
    );

  const close = () =>
    dialog.confirm(
      t.admin.resource.close,
      t.admin.resource.closeQuestion(
        resource.name,
        formatLongDate(earliestChange, t),
      ),
      {
        label: t.admin.resource.closeAction,
        onPress: () => {
          run(
            () =>
              unwrap(
                api.PUT('/admin/resources/{id}/closing', {
                  params: {path: {id: resource.id}},
                  body: {closesFrom: earliestChange},
                }),
              ),
            t.admin.resource.closeFailed,
          );
        },
      },
    );

  const reopen = () =>
    run(
      () =>
        unwrap(
          api.DELETE('/admin/resources/{id}/closing', {
            params: {path: {id: resource.id}},
          }),
        ),
      closed ? t.admin.resource.reopenFailed : t.admin.resource.undoCloseFailed,
    );

  if (mode === 'edit') {
    return (
      <ResourceForm
        kinds={kinds}
        initial={{...resource, slots: []}}
        withSlots={false}
        submitLabel={t.admin.save}
        onCancel={() => setMode('view')}
        onSubmit={async ({name, kindId, tags}) => {
          await unwrap(
            api.PATCH('/admin/resources/{id}', {
              params: {path: {id: resource.id}},
              body: {name, kindId, tags},
            }),
          );
          setMode('view');
          onChanged();
        }}
      />
    );
  }

  if (mode === 'schedule') {
    return (
      <ScheduleForm
        initial={latest?.slots ?? []}
        validFrom={earliestChange}
        onCancel={() => setMode('view')}
        onSubmit={async (slots) => {
          await unwrap(
            api.PUT('/admin/resources/{id}/schedule', {
              params: {path: {id: resource.id}},
              body: {validFrom: earliestChange, slots},
            }),
          );
          setMode('view');
          onChanged();
        }}
      />
    );
  }

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
              {schedule.validFrom >= earliestChange ? (
                <button
                  type='button'
                  onClick={() => removeChange(schedule.validFrom)}
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
              {kind ? `${kind.name} · ${limitText(kind, t)}` : '–'}
            </span>
          </div>
          <div className='flex items-baseline justify-between gap-4 py-2.5'>
            <span className='text-[13px] text-theme-muted'>
              {t.admin.resource.tags}
            </span>
            <span className='text-right text-sm text-theme-ink'>
              {resource.tags.length > 0 ? resource.tags.join(', ') : '–'}
            </span>
          </div>
        </div>
      </section>
      <section>
        <h2 className={SECTION_LABEL}>{t.admin.actions}</h2>
        <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
          <Action
            label={t.admin.resource.editTimes}
            description={t.admin.resource.editTimesHint(
              formatDayMonth(earliestChange, t),
            )}
            onPress={() => setMode('schedule')}
          />
          <Action
            label={t.admin.editDetails}
            description={t.admin.resource.editDetailsHint}
            onPress={() => setMode('edit')}
          />
        </div>
      </section>
      <div className='flex flex-wrap gap-2.5'>
        {siblings.length > 1 ? (
          <>
            <button
              type='button'
              onClick={() => move(-1)}
              disabled={busy || position === 0}
              className={SECONDARY_BUTTON}
            >
              {t.admin.resource.moveUp}
            </button>
            <button
              type='button'
              onClick={() => move(1)}
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
            onClick={reopen}
            disabled={busy}
            className={SECONDARY_BUTTON}
          >
            {closed ? t.admin.resource.reopen : t.admin.resource.undoClose}
          </button>
        ) : (
          <button
            type='button'
            onClick={close}
            disabled={busy}
            className={SECONDARY_BUTTON}
          >
            {t.admin.resource.close}
          </button>
        )}
      </div>
    </div>
  );
}
