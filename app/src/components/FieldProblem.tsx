import {Text} from 'react-native';

// What is wrong with the field above, said while it is filled in.
export function FieldProblem({message}: {message: string}) {
  return (
    <Text
      accessibilityLiveRegion='polite'
      className='ml-0.5 mt-1.5 font-sans text-[13px] leading-5 text-theme-danger'
    >
      {message}
    </Text>
  );
}
