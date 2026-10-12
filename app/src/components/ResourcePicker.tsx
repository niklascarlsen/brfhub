import type {Resource} from '@booking/core/api/types';
import {Pressable, ScrollView, Text} from 'react-native';

import {useRevealSelected} from '@/hooks/useRevealSelected';

type ResourcePickerProps = {
  resources: Resource[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function ResourcePicker({
  resources,
  selectedId,
  onSelect,
}: ResourcePickerProps) {
  const {scrollProps, itemLayout} = useRevealSelected(selectedId);

  return (
    <ScrollView
      {...scrollProps}
      horizontal
      showsHorizontalScrollIndicator={false}
      className='w-full grow-0'
      contentContainerClassName='gap-2 px-5'
    >
      {resources.map((resource) => {
        const selected = resource.id === selectedId;

        return (
          <Pressable
            key={resource.id}
            onPress={() => onSelect(resource.id)}
            onLayout={itemLayout(resource.id)}
            accessibilityRole='button'
            accessibilityState={{selected}}
            className={`h-11 justify-center rounded-full border px-5 ${
              selected
                ? 'border-theme-ink bg-theme-ink'
                : 'border-theme-line bg-theme-surface active:opacity-50'
            }`}
          >
            <Text
              numberOfLines={1}
              className={`text-sm ${
                selected
                  ? 'font-semibold text-theme-surface'
                  : 'font-medium text-theme-ink'
              }`}
            >
              {resource.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
