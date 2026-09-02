import {Pressable, Text, View} from 'react-native';

import type {Resource} from '@/api/client';

type ResourcePickerProps = {
  resources: Resource[];
  selectedId: string;
  onSelect: (id: string) => void;
};

const selectedLift = {
  shadowColor: '#14130F',
  shadowOpacity: 0.07,
  shadowOffset: {width: 0, height: 1},
  shadowRadius: 2,
  elevation: 1,
};

export function ResourcePicker({
  resources,
  selectedId,
  onSelect,
}: ResourcePickerProps) {
  return (
    <View className='mx-5 flex-row gap-[3px] rounded-xl bg-theme-track/80 p-[3px]'>
      {resources.map((resource) => {
        const selected = resource.id === selectedId;

        return (
          <Pressable
            key={resource.id}
            onPress={() => onSelect(resource.id)}
            style={selected ? selectedLift : undefined}
            className={`h-[38px] min-w-0 flex-1 items-center justify-center rounded-[9px] ${
              selected ? 'bg-theme-surface' : 'active:opacity-50'
            }`}
          >
            <Text
              numberOfLines={1}
              className={`text-sm ${
                selected
                  ? 'font-semibold text-theme-ink'
                  : 'font-medium text-theme-muted'
              }`}
            >
              {resource.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
