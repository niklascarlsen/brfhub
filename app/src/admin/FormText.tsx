import {Text} from 'react-native';

// A form's explanation under its fields.
export function Note({children}: {children: string}) {
  return (
    <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
      {children}
    </Text>
  );
}

// What came of saving the form.
export function Status({message}: {message: string | null}) {
  return message ? (
    <Text
      accessibilityRole='alert'
      className='font-sans text-sm text-theme-ink'
    >
      {message}
    </Text>
  ) : null;
}
