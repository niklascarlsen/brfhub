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
  const [mode, setMode] = useState<Mode>('view');
  const {kinds, earliestChange, today} = data;
  const kind = kinds.find((item) => item.id === resource.kindId);
  const [current, ...later] = resource.schedules;
  const latest = resource.schedules.at(-1);
  const closed = resource.closesFrom !== null && resource.closesFrom <= today;

  const fail = (title: string) => (caught: unknown) =>
    dialog.alert(title, errorMessage(codeOf(caught)));

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
      'Kunde inte flytta resursen',
    );
  };

  const removeChange = (validFrom: string) =>
    dialog.confirm(
      'Ta bort ändringen',
      `Tiderna från ${formatLongDate(validFrom)} tas bort, och de nuvarande gäller vidare.`,
      {
        label: 'Ta bort',
        onPress: () => {
          run(
            () =>
              unwrap(
                api.DELETE('/admin/resources/{id}/schedule/{validFrom}', {
                  params: {path: {id: resource.id, validFrom}},
                }),
              ),
            'Kunde inte ta bort ändringen',
          );
        },
      },
    );

  const close = () =>
    dialog.confirm(
      'Stäng resursen',
      `${resource.name} går att boka till och med dagen före ${formatLongDate(earliestChange)}. Bokningar fram till dess står kvar.`,
      {
        label: 'Stäng',
        onPress: () => {
          run(
            () =>
              unwrap(
                api.PUT('/admin/resources/{id}/closing', {
                  params: {path: {id: resource.id}},
                  body: {closesFrom: earliestChange},
                }),
              ),
            'Kunde inte stänga resursen',
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
      closed ? 'Kunde inte öppna resursen' : 'Kunde inte ångra stängningen',
    );

  if (mode === 'edit') {
    return (
      <ResourceForm
        kinds={kinds}
        initial={{...resource, slots: []}}
        withSlots={false}
        submitLabel='Spara'
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
        <h2 className={SECTION_LABEL}>Tider</h2>
        <div
          className={`${CARD} flex flex-col divide-y divide-theme-line py-1.5`}
        >
          <div className='flex flex-col gap-0.5 py-2.5'>
            <span className='text-[13px] text-theme-muted'>Nu</span>
            <span className='text-sm tabular-nums text-theme-ink'>
              {current ? slotsText(current.slots) : 'Inga pass'}
            </span>
          </div>
          {later.map((schedule) => (
            <div
              key={schedule.validFrom}
              className='flex items-center justify-between gap-4 py-2.5'
            >
              <span className='flex flex-col gap-0.5'>
                <span className='text-[13px] text-theme-accent'>
                  Från {formatDayMonth(schedule.validFrom)}
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
                  Ta bort
                </button>
              ) : null}
            </div>
          ))}
          {resource.closesFrom ? (
            <div className='flex flex-col gap-0.5 py-2.5'>
              <span className='text-[13px] text-theme-accent'>
                {closed ? 'Stängd sedan' : 'Stängs'}{' '}
                {formatDayMonth(resource.closesFrom)}
              </span>
            </div>
          ) : null}
        </div>
      </section>
      <section>
        <h2 className={SECTION_LABEL}>Uppgifter</h2>
        <div
          className={`${CARD} flex flex-col divide-y divide-theme-line py-1.5`}
        >
          <div className='flex items-baseline justify-between gap-4 py-2.5'>
            <span className='text-[13px] text-theme-muted'>Typ</span>
            <span className='text-right text-sm text-theme-ink'>
              {kind ? `${kind.name} · ${limitText(kind)}` : '–'}
            </span>
          </div>
          <div className='flex items-baseline justify-between gap-4 py-2.5'>
            <span className='text-[13px] text-theme-muted'>Taggar</span>
            <span className='text-right text-sm text-theme-ink'>
              {resource.tags.length > 0 ? resource.tags.join(', ') : '–'}
            </span>
          </div>
        </div>
      </section>
      <section>
        <h2 className={SECTION_LABEL}>Åtgärder</h2>
        <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
          <Action
            label='Ändra tider'
            description={`Gäller från ${formatDayMonth(earliestChange)}, efter bokningsfönstret`}
            onPress={() => setMode('schedule')}
          />
          <Action
            label='Ändra uppgifter'
            description='Namn, typ och taggar'
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
              Flytta upp
            </button>
            <button
              type='button'
              onClick={() => move(1)}
              disabled={busy || position === siblings.length - 1}
              className={SECONDARY_BUTTON}
            >
              Flytta ner
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
            {closed ? 'Öppna igen' : 'Ångra stängningen'}
          </button>
        ) : (
          <button
            type='button'
            onClick={close}
            disabled={busy}
            className={SECONDARY_BUTTON}
          >
            Stäng resursen
          </button>
        )}
      </div>
    </div>
  );
}
