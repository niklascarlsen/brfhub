import type {Resource} from '@/api/client';
import {Tag} from '@/components/Tag';
import {useRovingList} from '@/hooks/useRovingList';

type ResourcePickerProps = {
  resources: Resource[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
  showTags?: boolean;
};

export function ResourcePicker({
  resources,
  selectedId,
  onSelect,
  className = '',
  showTags = false,
}: ResourcePickerProps) {
  const anyTagged =
    showTags && resources.some((resource) => resource.tags.length > 0);

  const roving = useRovingList({
    count: resources.length,
    orientation: 'horizontal',
    resetKey: selectedId,
    startAt: Math.max(
      resources.findIndex((resource) => resource.id === selectedId),
      0,
    ),
  });

  return (
    <div className={className}>
      <div
        role='toolbar'
        aria-label='Välj utrymme'
        aria-orientation={roving.orientation}
        onKeyDown={roving.onKeyDown}
        className='flex gap-0.75 rounded-xl bg-theme-track/80 p-0.75'
      >
        {resources.map((resource, index) => {
          const selected = resource.id === selectedId;

          return (
            <button
              type='button'
              key={resource.id}
              onClick={() => onSelect(resource.id)}
              aria-pressed={selected}
              {...roving.itemProps(index)}
              className={`h-9.5 min-w-0 flex-1 truncate rounded-[9px] px-2 text-xs ${
                selected
                  ? 'bg-theme-surface font-semibold text-theme-ink shadow-[0_1px_2px_rgba(20,19,15,0.07)]'
                  : 'font-medium text-theme-muted hover:text-theme-ink active:opacity-50'
              }`}
            >
              {resource.name}
            </button>
          );
        })}
      </div>
      {anyTagged ? (
        <div className='mt-2 flex gap-0.75 px-0.75'>
          {resources.map((resource) => (
            <div
              key={resource.id}
              className='flex min-w-0 flex-1 flex-wrap gap-1.5'
            >
              {resource.id === selectedId
                ? resource.tags.map((tag) => <Tag key={tag} label={tag} />)
                : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
