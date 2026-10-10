import type {Messages} from '@/i18n/catalog';

// The English catalog, the same file in app/ and web/ like sv.ts.
export const en: Messages = {
  dates: {
    locale: 'en-GB',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    today: 'Today',
    tomorrow: 'Tomorrow',
  },
  common: {
    retry: 'Try again',
    cancel: 'Cancel',
    ok: 'OK',
    email: 'Email',
    loading: 'Loading',
  },
  language: {
    heading: 'Language',
    system: 'System',
    name: 'English',
  },
  errors: {
    HAS_ACTIVE_BOOKING: 'You already have a booking',
    SLOT_TAKEN: 'That time is already booked',
    SLOT_IN_PAST: 'That time has already passed',
    SLOT_STARTED: 'That time has started, it is drop-in now',
    OUTSIDE_BOOKING_WINDOW: 'That day cannot be booked yet',
    SLOT_AVAILABLE: 'That time is free, book it instead',
    APARTMENT_TAKEN: 'There is already an apartment with that number',
    EMAIL_TAKEN: 'Another account already uses that email address',
    CHANGE_INSIDE_WINDOW:
      'The change cannot start before the booking window has passed',
    ENDS_IN_PAST: 'The end date has already passed',
    INVALID_SCHEDULE: 'The slots overlap or end before they start',
    KIND_IN_USE: 'Resources still use that type',
    NOT_FOUND: 'Not found',
    UNAUTHORIZED: 'You are not signed in',
    FORBIDDEN: 'That is not your booking',
    VALIDATION: 'Invalid request',
    NETWORK: 'Cannot reach the server',
    TIMEOUT: 'The server did not answer in time, try again',
    SERVER_ERROR: 'Something went wrong on the server, try again shortly',
    UNKNOWN: 'Something went wrong',
  },
  login: {
    title: 'Sign in',
    intro: "With the apartment's or the association admin's email.",
    password: 'Password',
    submit: 'Sign in',
    wrongCredentials: 'Wrong email or password',
    tooManyAttempts: 'Too many attempts, wait a moment',
    originRefused: 'The server does not allow this address',
  },
  account: {
    heading: 'Account',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    signOutQuestion: (from: string) => `Sign out of ${from}?`,
    noApartmentTitle: 'The account has no apartment',
    noApartmentMessage:
      'Your account is not linked to an apartment. Contact the board.',
    nothingToBookTitle: 'Nothing to book',
    nothingToBookMessage: 'There is nothing to book right now.',
  },
  apartment: {
    title: (label: string) => `Apartment ${label}`,
    signOutFrom: (label: string) => `apartment ${label}`,
    backToBooking: 'Back to booking',
  },
  times: {
    emptyTitle: 'Nothing here yet.',
    emptyMessage: 'When you book a time or join a queue, it shows up here.',
    bookings: 'Bookings',
    queue: 'Queued',
    ended: 'Ended',
    done: "I'm done",
    cancel: 'Cancel',
    dropIn: 'Drop-in',
    freeNow: 'Free now',
    book: 'Book',
    leaveQueue: 'Leave queue',
  },
  booking: {
    bookFailed: 'Could not book',
    queueFailed: 'Could not join the queue',
    leaveQueueFailed: 'Could not leave the queue',
    cancelFailed: 'Could not cancel',
    releaseFailed: 'Could not open the time',
    alreadyBookedTitle: 'You already have a booking',
    swap: 'Switch',
    swapQuestion: (when: string) => `Switch to ${when}?`,
    queueTitle: 'Join the queue',
    queueMe: 'Join the queue',
    queueQuestion: (when: string) =>
      `We will let you know if ${when} becomes free. First come, first served.`,
    leaveQueueQuestion: (when: string) => `Leave the queue for ${when}?`,
    cancelTitle: 'Cancel booking',
    cancelQuestion: (when: string) => `Cancel ${when}?`,
    releaseTitle: 'Open for drop-in',
    releaseQuestion: (when: string) =>
      `Others can take ${when} as drop-in. You cannot book a new time until this one is over.`,
    releasedBlocks: 'You cannot book a new time until this one is over.',
    freeSlots: (count: number) =>
      count === 1 ? '1 free slot' : `${count} free slots`,
    previousDay: 'Previous day',
    nextDay: 'Next day',
    noSlotsLeft: 'No times left this day',
    slotsOfDay: 'Times this day',
    chooseResource: 'Choose a space',
    greeting: (apartment: string) => `Hello, apartment ${apartment}`,
    nextTime: 'Your next time',
    bookTitle: 'Book time',
    bookQuestion: (when: string) => `Book ${when}?`,
  },
  calendar: {
    chooseDay: 'Choose a day',
    full: 'full',
    noFreeSlots: 'no free slots',
    yourTime: 'your time',
    legend: 'The number is free slots across all spaces.',
  },
  slots: {
    mine: 'Your time',
    freeNow: 'Free now',
    free: 'Free',
    dropIn: 'Drop-in',
    queued: 'Queued',
    taken: 'Taken',
  },
  rules: {
    heading: 'Rules',
    bookableDaysAhead: (days: number) => `Bookable ${days} days ahead`,
    joinList: (first: string, last: string) => `${first} and ${last}`,
    oneBooking: 'One booking at a time',
    oneBookingShared: 'One booking at a time, for all of them together',
    upToBookings: (count: number) => `Up to ${count} bookings at a time`,
    changesFrom: (day: string, times: string) => `From ${day} ${times}`,
    closes: (day: string) => `Closes ${day}`,
  },
  announcements: {
    heading: 'Notices',
    hide: 'Hide',
  },
  push: {
    channel: 'Free times',
    promptTitle: 'Notifications',
    promptMessage:
      'Do you want a notification when a time you are queuing for becomes free?',
    turnOn: 'Turn on',
    failedTitle: 'Could not turn on notifications',
    failedMessage:
      "Allow notifications for this app in the browser's settings.",
  },
  admin: {
    add: 'Add',
    save: 'Save',
    remove: 'Remove',
    details: 'Details',
    actions: 'Actions',
    editDetails: 'Edit details',
    apartments: {
      newTitle: 'New apartment',
      newNote:
        'The apartment gets a password that is shown once, after you save.',
      addApartment: 'Add apartment',
      none: 'No apartments yet. Add the first one.',
      search: 'Search number, name or email',
      noMatch: 'No apartment matches.',
      count: (count: number) =>
        count === 1 ? '1 apartment' : `${count} apartments`,
    },
    apartment: {
      cancelNote: (upcoming: number) => {
        if (upcoming === 0) {
          return 'The apartment has no upcoming bookings.';
        }

        const bookings =
          upcoming === 1
            ? '1 upcoming booking'
            : `${upcoming} upcoming bookings`;

        return `The apartment's ${bookings} will be cancelled, and anyone queuing gets a notification.`;
      },
      resetPassword: 'Reset password',
      resetPasswordHint: 'When the residents have forgotten it',
      resetQuestion: (label: string) =>
        `Apartment ${label} gets a new password and is signed out on every device.`,
      reset: 'Reset',
      resetFailed: 'Could not reset the password',
      remove: 'Remove apartment',
      removeQuestion: (cancelNote: string) =>
        `${cancelNote} The account is removed and the number can be used again.`,
      removeFailed: 'Could not remove the apartment',
      editNote:
        'If the email changes, the apartment is signed out and signs in with the new address.',
      newResidentNote: (cancelNote: string) =>
        `${cancelNote} The old account is removed and the new residents get their own password.`,
      replaceResident: 'Change residents',
      never: 'Never',
      resident: 'Residents',
      lastSignIn: 'Last signed in',
      upcomingBookings: 'Upcoming bookings',
      editDetailsHint: 'Number, name and email',
      newResident: 'New residents',
      newResidentHint: 'When the apartment changes owner',
    },
    resources: {
      newKind: 'New type',
      newResource: 'New resource',
      edit: 'Edit',
      closed: 'Closed',
      newTimes: (day: string) => `New times ${day}`,
      noSlots: 'No slots',
      removeKindFailed: 'Could not remove the type',
      startWithKind:
        'Start with a type, such as Laundry or Sauna. The type decides how many bookings an apartment may hold at a time.',
      noneOfKind: 'No resources of this type.',
    },
    resource: {
      times: 'Times',
      now: 'Now',
      from: (day: string) => `From ${day}`,
      closedSince: (day: string) => `Closed since ${day}`,
      kind: 'Type',
      tags: 'Tags',
      editTimes: 'Change times',
      editTimesHint: (day: string) =>
        `Applies from ${day}, after the booking window`,
      editDetailsHint: 'Name, type and tags',
      moveUp: 'Move up',
      moveDown: 'Move down',
      moveFailed: 'Could not move the resource',
      removeChange: 'Remove the change',
      removeChangeQuestion: (day: string) =>
        `The times from ${day} are removed, and the current ones stay.`,
      removeChangeFailed: 'Could not remove the change',
      close: 'Close resource',
      closeAction: 'Close',
      closeQuestion: (name: string, day: string) =>
        `${name} can be booked up to the day before ${day}. Bookings until then stay.`,
      closeFailed: 'Could not close the resource',
      reopen: 'Open again',
      undoClose: 'Undo closing',
      reopenFailed: 'Could not open the resource',
      undoCloseFailed: 'Could not undo the closing',
    },
    resourceForm: {
      name: 'Name, for example Laundry room 1',
      tags: 'Tags, separated by commas',
      slots: 'Slots',
    },
    kindForm: {
      name: 'Name, for example Laundry',
      limit: 'Bookings at a time',
      limitHint: 'Per apartment, for all resources of the type together',
      limitNote:
        'A changed limit applies to new bookings. Those already made stay.',
      fewer: 'Fewer',
      more: 'More',
      remove: 'Remove type',
    },
    scheduleForm: {
      note: (day: string) =>
        `The new times apply from ${day}. The time until then can already be booked, so those bookings stay.`,
      save: 'Save times',
    },
    slots: {
      starts: 'Starts',
      ends: 'Ends',
      endsNextDay: 'Ends the next day',
      nextDay: 'Next day',
      add: 'Add slot',
    },
    apartmentForm: {
      number: 'Apartment number',
      residentName: "Residents' name",
      checkEmail: 'Check the email address',
    },
    announcementForm: {
      title: 'Heading',
      body: 'Text',
      shownFor: 'Shown',
      shown: (from: string, to: string | null) =>
        to ? `From ${from} up to and including ${to}.` : `From ${from}.`,
    },
    organization: {
      settings: 'Settings',
      name: "Association's name",
      windowDays: 'Bookable number of days ahead',
      windowRange: (max: number) => `The booking window is 1 to ${max} days`,
      windowNote:
        'A longer window opens more days at once. A shorter one does not remove bookings already made.',
      rules: 'House rules',
      rulesPlaceholder: 'For example: Clean up after yourself. Quiet after 22.',
      rulesNote: 'Shown to the apartments above the times and limits.',
      saved: 'Saved.',
      changePassword: 'Change password',
      currentPassword: 'Current password',
      newPassword: 'New password',
      repeatPassword: 'New password again',
      passwordNote:
        'Change the password when the board changes. Every other device is signed out.',
      wrongPassword: 'The current password is wrong',
      passwordTooShort: (min: number) =>
        `The new password must be at least ${min} characters`,
      passwordTooLong: 'The new password is too long',
      passwordsDiffer: 'The new passwords do not match',
      passwordChanged:
        'The password is changed. Every other device has been signed out.',
    },
    password: {
      title: (label: string) => `Password for apartment ${label}`,
      beforeEmail:
        'Shown only now. Give it to the residents together with the email address',
      afterEmail: '. They sign in with both.',
      login: (label: string, email: string, password: string) =>
        `Sign-in for apartment ${label}\nEmail: ${email}\nPassword: ${password}`,
      share: 'Share sign-in',
      copy: 'Copy sign-in',
      copied: 'Sign-in copied',
      copyFailed:
        'Copying does not work here. Select the password and copy it yourself.',
      done: 'Done',
    },
    schedule: {
      noSlots: 'Add at least one slot',
      timeFormat: 'Write the times as 08:00',
      endsBeforeStart:
        'A slot ends before it starts. If it ends after midnight, choose next day.',
    },
    announcements: {
      untilFurther: 'Until further notice',
      oneWeek: '1 week',
      twoWeeks: '2 weeks',
      oneMonth: '1 month',
      new: 'New notice',
      publish: 'Publish',
      active: 'Shown now',
      scheduled: 'Upcoming',
      ended: 'Ended',
      period: (from: string, to: string) => `${from} to ${to}`,
      openPeriod: (from: string) => `From ${from}, until further notice`,
      remove: 'Remove notice',
      removeQuestion: (title: string) =>
        `“${title}” is removed and no longer shown.`,
      removeFailed: 'Could not remove the notice',
      none: 'No notices yet. A notice is shown at the top for every apartment, for example about a cleaning day or the laundry room being closed.',
    },
  },
  tabs: {
    book: 'Book',
    myTimes: 'My times',
    apartment: 'Apartment',
    apartments: 'Apartments',
    resources: 'Resources',
    announcements: 'Notices',
    organization: 'Association',
    mainMenu: 'Main menu',
  },
};
