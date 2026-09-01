import {Pressable, ScrollView, Text, View} from 'react-native';

import type {Resource} from '@/api/client';

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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className='w-full grow-0'
      contentContainerClassName='px-5 pb-1 pt-3'
    >
      <View className='flex-row gap-2'>
        {resources.map((resource) => {
          const selected = resource.id === selectedId;

          return (
            <Pressable
              key={resource.id}
              onPress={() => onSelect(resource.id)}
              className={`rounded-full px-4 py-2 ${
                selected ? 'bg-theme-ink' : 'bg-theme-surface'
              } active:opacity-70`}
            >
              <Text
                className={`text-sm font-semibold ${
                  selected ? 'text-theme-surface' : 'text-theme-ink'
                }`}
              >
                {resource.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
