import type {Resource} from '@/api/client';
import {Tag} from '@/components/Tag';
import {useRevealSelected} from '@/hooks/useRevealSelected';
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
  const scroller = useRevealSelected(selectedId);
  const selected = resources.find((resource) => resource.id === selectedId);
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
        ref={scroller}
        role='toolbar'
        aria-label='Välj utrymme'
        aria-orientation={roving.orientation}
        onKeyDown={roving.onKeyDown}
        className='flex scroll-px-5 gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden'
      >
        {resources.map((resource, index) => {
          const isSelected = resource.id === selectedId;

          return (
            <button
              type='button'
              key={resource.id}
              onClick={() => onSelect(resource.id)}
              aria-pressed={isSelected}
              {...roving.itemProps(index)}
              className={`h-11 shrink-0 rounded-full border px-5 text-sm whitespace-nowrap ${
                isSelected
                  ? 'border-theme-ink bg-theme-ink font-semibold text-theme-surface'
                  : 'border-theme-line bg-theme-surface font-medium text-theme-ink hover:bg-theme-sunk active:opacity-50'
              }`}
            >
              {resource.name}
            </button>
          );
        })}
      </div>
      {anyTagged ? (
        <div className='mt-1 flex min-h-5.75 flex-wrap gap-1.5'>
          {selected?.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
