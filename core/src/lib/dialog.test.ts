import {describe, expect, test} from 'vitest';

import {en} from '../i18n/en';
import {sv} from '../i18n/sv';
import {dismissLabel} from './dialog';

const onPress = () => {};

describe('the button that closes a confirmation', () => {
  test('cancels a question that does nothing harmful', () => {
    expect(dismissLabel({label: 'Book', onPress}, en)).toBe('Cancel');
  });

  test('keeps what a destructive action would remove', () => {
    const cancelBooking = {
      label: en.times.cancel,
      destructive: true,
      onPress,
    };

    expect(dismissLabel(cancelBooking, en)).toBe('Keep');
    expect(dismissLabel({...cancelBooking, label: sv.times.cancel}, sv)).toBe(
      'Behåll',
    );
  });

  test('says what the question asks for, when it is given', () => {
    expect(
      dismissLabel(
        {label: 'Leave', destructive: true, cancelLabel: 'Stay', onPress},
        en,
      ),
    ).toBe('Stay');
  });
});
