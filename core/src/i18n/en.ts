import type {Messages} from './catalog';

// The English catalog, shared by both clients like sv.ts.
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
    yesterday: 'Yesterday',
  },
  common: {
    retry: 'Try again',
    cancel: 'Cancel',
    keep: 'Keep',
    ok: 'OK',
    email: 'Email',
    loading: 'Loading',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },
  language: {
    heading: 'Language',
    system: 'System',
    name: 'English',
    names: {sv: 'Swedish', en: 'English'},
  },
  errors: {
    HAS_ACTIVE_BOOKING: 'You already have a booking',
    SLOT_TAKEN: 'That time is already booked',
    SLOT_IN_PAST: 'That time has already passed',
    SLOT_STARTED: 'That time has started and is now drop-in',
    OUTSIDE_BOOKING_WINDOW: 'That day cannot be booked yet',
    SLOT_AVAILABLE: 'That time is free, book it instead',
    APARTMENT_TAKEN: 'There is already an apartment with that number',
    EMAIL_TAKEN: 'Another account already uses that email address',
    CHANGE_TOO_EARLY: 'That day can no longer be chosen. Choose a later day.',
    CHANGE_CANCELS_BOOKINGS:
      'Someone booked meanwhile. Try again to see which bookings are cancelled.',
    ENDS_IN_PAST: 'The end date has already passed',
    INVALID_SCHEDULE: 'The slots overlap or end before they start',
    RESOURCE_OPEN: 'Close the resource before removing it',
    KIND_IN_USE: 'Resources still use that type',
    LANGUAGES_CHANGED:
      "The association's languages changed since the page was opened. Reload and try again.",
    TWO_FACTOR_REQUIRED: 'Set up two-step verification first',
    LAST_ADMIN: 'The association needs at least one administrator',
    OWN_ACCOUNT: 'That cannot be done to your own account',
    NOT_FOUND: 'Not found',
    UNAUTHORIZED: 'You are not signed in',
    FORBIDDEN: 'Your account is not allowed to do that',
    VALIDATION: 'Invalid request',
    NETWORK: 'Cannot reach the server',
    TIMEOUT: 'The server did not answer in time, try again',
    SERVER_ERROR: 'Something went wrong on the server, try again shortly',
    RATE_LIMITED: 'Too many attempts, wait a minute',
    UNKNOWN: 'Something went wrong',
  },
  login: {
    title: 'Sign in',
    intro: "With your apartment's email, or your admin account's.",
    continue: 'Continue',
    codeTitle: 'Enter the code',
    codeIntro: (email: string) =>
      `We have sent a six-digit code to ${email}. If it is not there, check your spam folder.`,
    code: 'Code',
    wrongCode: 'Wrong code. Check the email and try again.',
    codeExpired: 'The code has expired. Send a new one.',
    tooManyCodeAttempts: 'Too many attempts. Send a new code.',
    sendNewCode: 'Send a new code',
    codeSent: 'A new code has been sent.',
    changeEmail: 'Change email',
    passwordTitle: 'Enter the password',
    passwordIntro: (email: string) => `The password for ${email}.`,
    password: 'Password',
    submit: 'Sign in',
    wrongCredentials: 'Wrong email or password',
    tooManyAttempts: 'Too many attempts, wait a moment',
    originRefused: 'The server does not allow this address',
    setPassword: 'Forgot your password?',
    totpTitle: 'Enter the code from your authenticator',
    totpIntro: 'Open your authenticator app and type in the code it shows.',
    totpCode: 'Code from the app',
    useBackupCode: 'Use a backup code instead',
    backupTitle: 'Enter a backup code',
    backupIntro:
      'One of the codes you got when you set up your authenticator. Each code works once.',
    backupCode: 'Backup code',
    useTotp: 'Use the authenticator app instead',
    trustDevice: 'Trust this device for 30 days',
    startOver: 'Start over',
    resetTitle: 'Choose a password',
    resetIntro: (email: string) =>
      `We have sent a code to ${email}. Type it in and choose a password.`,
    newPassword: 'Password',
    repeatPassword: 'Password again',
    resetSubmit: 'Save and sign in',
  },
  twoFactor: {
    title: 'Set up two-step verification',
    intro:
      'As an admin you sign in with a password and a code from an authenticator app, such as Google Authenticator, 1Password or Passwords on iPhone. Confirm your password to begin.',
    password: 'Password',
    begin: 'Begin',
    scanTitle: 'Scan the code',
    scanIntro:
      'Scan the QR code in your authenticator app, or type the key in by hand. Then enter the code the app shows.',
    manualKey: 'Key to type in',
    qrCode: 'QR code for the authenticator app',
    firstCode: 'Code from the app',
    verify: 'Confirm',
    backupTitle: 'Save your backup codes',
    backupIntro:
      'If you lose your phone, sign in with one of these codes instead. Each code works once. Keep them somewhere safe, they are shown only now.',
    copyCodes: 'Copy the codes',
    shareCodes: 'Share the codes',
    copied: 'Codes copied',
    done: 'Done',
    wrongPassword: 'The password is wrong',
    alreadyEnabled:
      'Two-step verification is already on. Sign out and in again.',
    wrongCode: 'Wrong code. Wait for the app to show a new one and try again.',
    locked: 'Too many failures. Wait fifteen minutes and try again.',
  },
  account: {
    heading: 'Account',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    signOutQuestion: (from: string) => `Sign out of ${from}?`,
    openAdmin: 'Manage the association',
    openBooking: 'Back to booking',
    noApartmentTitle: 'The account has no apartment',
    noApartmentMessage:
      'Your account is not linked to an apartment. Contact the board.',
    nothingToBookTitle: 'Nothing to book',
    nothingToBookMessage: 'There are no spaces to book right now.',
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
    done: "I'm done",
    cancel: 'Cancel booking',
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
    releaseFailed: 'Could not open the time for drop-in',
    alreadyHolding: (count: number) =>
      count === 1
        ? 'You already have a booking'
        : `You already have ${count} bookings`,
    swap: 'Switch',
    swapQuestion: (from: string, to: string) => `Switch ${from} for ${to}?`,
    chooseSwapTitle: 'Switch which one?',
    chooseSwapQuestion: (to: string) =>
      `Which of your bookings do you want to switch for ${to}?`,
    queueTitle: 'Join the queue',
    queueMe: 'Join the queue',
    queueQuestion: (when: string) =>
      `We will let you know if ${when} becomes free. First come, first served.`,
    leaveQueueQuestion: (when: string) => `Leave the queue for ${when}?`,
    stayInQueue: 'Stay in queue',
    cancelTitle: 'Cancel booking',
    cancelQuestion: (when: string) => `Cancel ${when}?`,
    releaseTitle: 'Open for drop-in',
    releaseQuestion: (when: string) =>
      `Others can take ${when} as drop-in. You cannot book a new time until this one is over.`,
    fullUntilOver: (count: number) =>
      count === 1
        ? 'You cannot book a new time until this one is over.'
        : 'You cannot book a new time until one of yours is over.',
    freeSlots: (count: number) =>
      count === 1 ? '1 free slot' : `${count} free slots`,
    previousDay: 'Previous day',
    nextDay: 'Next day',
    noSlotsLeft: 'No times left on this day',
    closedTitle: 'Temporarily closed',
    closedMessage: 'It cannot be booked right now.',
    slotsOfDay: 'Times this day',
    chooseResource: 'Choose a space',
    greeting: (apartment: string) => `Hello, apartment ${apartment}`,
    nextTime: 'Your next booking',
    bookTitle: 'Book a time',
    bookQuestion: (when: string) => `Book ${when}?`,
  },
  calendar: {
    chooseDay: 'Choose a day',
    noFreeSlots: 'no free slots',
    yourTime: 'your time',
    legendMine: 'Your time',
    legendFull: 'Fully booked',
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
    heading: 'House rules',
    timesHeading: 'Bookable times',
    bookableDaysAhead: (days: number) => `${days} days ahead`,
    joinList: (first: string, last: string) => `${first} and ${last}`,
    oneBooking: 'One booking at a time',
    oneBookingShared: 'One booking at a time across all of them',
    upToBookings: (count: number) => `Up to ${count} bookings at a time`,
    changesFrom: (day: string, times: string) => `From ${day} ${times}`,
    closes: (day: string) => `Closes ${day}`,
    closed: 'Temporarily closed',
    withNote: (closing: string, note: string) => `${closing}. ${note}`,
  },
  announcements: {
    heading: 'Notices',
    hide: 'Hide',
    withPosition: (day: string, index: number, count: number) =>
      `${day} · ${index} of ${count}`,
  },
  push: {
    channel: 'Available times',
    announcementsChannel: 'Announcements',
    promptTitle: 'Notifications',
    promptMessage:
      'Do you want a notification when a time you are queuing for becomes free, and when the board posts an announcement?',
    turnOn: 'Turn on',
    failedTitle: 'Could not turn on notifications',
    failedMessage:
      "Allow notifications for this app in the browser's settings.",
    toggle: 'Notifications',
    toggleHint:
      'When a time you are queuing for becomes free, and when the board posts an announcement.',
    blockedTitle: 'Notifications are off',
    blockedMessage:
      "You have declined notifications from the app. Turn them on in the phone's settings.",
    openSettings: 'Open settings',
  },
  admin: {
    add: 'Add',
    save: 'Save',
    remove: 'Remove',
    details: 'Details',
    actions: 'Actions',
    goneTitle: 'No longer here',
    gone: 'It may have been removed, or the link is old.',
    editDetails: 'Edit details',
    unsaved: {
      hint: 'Unsaved changes',
      title: 'Leave without saving?',
      message: 'What you have changed will not be saved.',
      stay: 'Stay',
      leave: 'Leave',
    },
    apartments: {
      newTitle: 'New apartment',
      newNote:
        'The residents get an email saying how to sign in, once you save.',
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
      signOut: 'Sign out everywhere',
      signOutHint: 'When a phone has gone missing',
      signOutQuestion: (label: string) =>
        `Apartment ${label} is signed out on every device. The residents sign in again with a new code from their email.`,
      signOutFailed: 'Could not sign the apartment out',
      remove: 'Remove apartment',
      removeQuestion: (cancelNote: string) =>
        `${cancelNote} The account is removed and the number can be used again.`,
      removeFailed: 'Could not remove the apartment',
      editNote:
        'If the email changes, the apartment is signed out, and the new address gets an email saying how to sign in.',
      newResidentNote: (cancelNote: string) =>
        `${cancelNote} The old account is removed and the new residents get an email saying how to sign in.`,
      replaceResident: 'Change residents',
      never: 'Never',
      resident: 'Residents',
      lastSignIn: 'Last signed in',
      upcomingBookings: 'Upcoming bookings',
      editDetailsHint: 'Number, name and email',
      newResident: 'New residents',
      newResidentHint: 'When the apartment changes hands',
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
      editTimesHint: (day: string) => `No bookings are affected from ${day}`,
      editDetailsHint: 'Name, type and tags',
      moveUp: 'Move up',
      moveDown: 'Move down',
      moveFailed: 'Could not move the resource',
      removeChange: 'Remove the change',
      removeChangeQuestion: (day: string) =>
        `The times from ${day} are removed, and the current ones stay.`,
      removeChangeFailed: 'Could not remove the change',
      close: 'Close resource',
      closeHint: 'From a day you choose, such as after a breakdown',
      reopen: 'Reopen',
      undoClose: 'Undo closing',
      reopenFailed: 'Could not open the resource',
      remove: 'Remove resource',
      removableFrom: (day: string) =>
        `Can be removed from ${day}, once it has closed.`,
      removeQuestion: (name: string) =>
        `${name} is removed for good, with its times and past bookings. This cannot be undone.`,
      removeFailed: 'Could not remove the resource',
      undoCloseFailed: 'Could not undo the closing',
    },
    resourceForm: {
      name: 'Name, e.g. Laundry room 1',
      tags: 'Tags, separated by commas',
      slots: 'Slots',
    },
    kindForm: {
      name: 'Name, e.g. Laundry',
      limit: 'Bookings at a time',
      limitHint: 'Per apartment, across all resources of this type',
      limitNote:
        'A changed limit applies to new bookings. Those already made stay.',
      fewer: 'Fewer',
      more: 'More',
      remove: 'Remove type',
    },
    scheduleForm: {
      from: 'Applies from',
      save: 'Save times',
    },
    closeForm: {
      from: 'Closed from',
      note: (name: string) =>
        `${name} can be booked up to the day before. Reopen it whenever you like.`,
      save: 'Close resource',
    },
    change: {
      noCancels: 'No bookings are affected.',
      mayCancel: (day: string) =>
        `Bookings that are affected are cancelled, and you see which before anything is saved. From ${day} none are affected.`,
      reason: 'Message to those cancelled',
      reasonHint: 'Sent with the email and the notification. Optional.',
      note: 'Message to the residents',
      noteHint:
        'Shown on the closed resource and sent to those cancelled. Optional.',
      cancelTitle: (count: number) =>
        count === 1
          ? 'One booking is cancelled'
          : `${count} bookings are cancelled`,
      cancelLine: (apartment: string, when: string) =>
        `Apt ${apartment}: ${when}`,
      cancelMore: (count: number) => `and ${count} more`,
      told: (apartments: number) =>
        apartments === 1
          ? 'The apartment gets an email and a notification about it.'
          : 'The apartments get an email and a notification about it.',
      cancelAndSave: 'Cancel and save',
      cancelAndClose: 'Cancel and close',
      cancelAndRemove: 'Cancel and remove',
    },
    slots: {
      starts: 'Starts',
      ends: 'Ends',
      endsNextDay: 'Ends the next day',
      add: 'Add slot',
    },
    field: {
      required: 'Required',
      tooLong: (length: number, max: number) =>
        `Too long, ${length} of at most ${max} characters`,
      tagTooLong: (max: number) => `A tag can have at most ${max} characters`,
      tooManyTags: (max: number) => `At most ${max} tags`,
      rejected:
        'The server did not accept the details. Check the fields and try again.',
    },
    apartmentForm: {
      number: 'Apartment number',
      residentName: "Residents' names",
      checkEmail: 'Check the email address',
    },
    announcementForm: {
      title: 'Title',
      body: 'Text',
      shownFor: 'Show for',
      shown: (from: string, to: string | null) =>
        to ? `From ${from} up to and including ${to}.` : `From ${from}.`,
    },
    localized: {
      label: (label: string, language: string) => `${label} (${language})`,
      untranslated: (languages: string) => `Missing ${languages}`,
      tagsInEvery: 'Write tags in every language, or leave them all empty.',
      rulesInEvery:
        'Write the rules in every language, or leave them all empty.',
      reasonInEvery:
        'Write the message in every language, or leave them all empty.',
      missing: (languages: string, what: string) =>
        `Not yet in ${languages}: ${what}.`,
      kinds: (count: number) => (count === 1 ? '1 type' : `${count} types`),
      resources: (count: number) =>
        count === 1 ? '1 resource' : `${count} resources`,
      announcements: (count: number) =>
        count === 1 ? '1 notice' : `${count} notices`,
      rules: 'the house rules',
    },
    admins: {
      title: 'Administrators',
      note: 'Every administrator can do everything here. Whoever is added gets an email saying how to sign in.',
      add: 'Add administrator',
      name: 'Name',
      you: 'you',
      lives: (label: string) => `Lives in apartment ${label}`,
      count: (count: number) =>
        count === 1 ? '1 administrator' : `${count} administrators`,
      withoutTwoFactor: (count: number) => `${count} without two-step`,
      twoFactorMissing: 'No two-step yet',
      apartment: 'Apartment',
      twoFactor: 'Two-step verification',
      twoFactorOn: 'Set up',
      twoFactorOff: 'Not set up yet',
      resetHint: 'When a phone has gone missing',
      removeAdmin: 'Remove as administrator',
      lastSignIn: (when: string) => `Last signed in ${when}`,
      never: 'Has never signed in',
      removeQuestion: (email: string) =>
        `${email} is signed out and can no longer manage the association. A resident keeps their apartment.`,
      removeFailed: 'Could not remove the administrator',
      resetTwoFactor: 'Reset two-step verification',
      resetQuestion: (email: string) =>
        `${email} is signed out everywhere and sets up a new authenticator at the next sign-in. Do this when a phone has gone missing.`,
      reset: 'Reset',
      resetFailed: 'Could not reset',
      checkEmail: 'Check the email address',
    },
    events: {
      title: 'History',
      note: 'What the administrators have done, newest first. The history is kept for 12 months.',
      none: 'Nothing has happened in the last year.',
      noneIn: 'Nothing here in the last year.',
      filter: 'Show',
      all: 'All',
      areas: {
        apartments: 'Apartments',
        resources: 'Resources',
        announcements: 'Notices',
        admins: 'Administrators',
        organization: 'Settings',
      },
      actions: {
        'apartment.create': (subject: string) => `Added apartment ${subject}`,
        'apartment.update': (subject: string) => `Changed apartment ${subject}`,
        'apartment.newResident': (subject: string) =>
          `Changed the residents of apartment ${subject}`,
        'apartment.signOut': (subject: string) =>
          `Signed apartment ${subject} out everywhere`,
        'apartment.remove': (subject: string) => `Removed apartment ${subject}`,
        'admin.add': (subject: string) =>
          `Added ${subject} as an administrator`,
        'admin.remove': (subject: string) =>
          `Removed ${subject} as an administrator`,
        'admin.resetTwoFactor': (subject: string) =>
          `Reset two-step verification for ${subject}`,
        'kind.create': (subject: string) => `Added the kind ${subject}`,
        'kind.update': (subject: string) => `Changed the kind ${subject}`,
        'kind.remove': (subject: string) => `Removed the kind ${subject}`,
        'resource.create': (subject: string) => `Added ${subject}`,
        'resource.update': (subject: string) => `Changed ${subject}`,
        'resource.order': () => 'Changed the order of the resources',
        'resource.close': (subject: string) => `Closed ${subject}`,
        'resource.reopen': (subject: string) => `Reopened ${subject}`,
        'resource.remove': (subject: string) => `Removed ${subject}`,
        'schedule.put': (subject: string) =>
          `Changed the schedule of ${subject}`,
        'booking.cancel': (subject: string) =>
          `Cancelled apartments' bookings in ${subject}`,
        'schedule.remove': (subject: string) =>
          `Removed the schedule of ${subject}`,
        'announcement.create': (subject: string) =>
          `Published the announcement ${subject}`,
        'announcement.update': (subject: string) =>
          `Changed the announcement ${subject}`,
        'announcement.remove': (subject: string) =>
          `Removed the announcement ${subject}`,
        'organization.update': (subject: string) =>
          `Changed the settings: ${subject}`,
      },
      settingsParts: {
        name: 'the name',
        bookingWindowDays: 'the booking window',
        locales: 'the languages',
        rulesText: 'the rules',
      },
    },
    organization: {
      languages: 'Association languages',
      languagesNote:
        "Apartments can pick among the languages turned on. With more than one, you write the association's texts in each. Anything not yet translated shows in the language it was written in.",
      name: 'Association name',
      windowDays: 'Days bookable ahead',
      windowRange: (min: number, max: number) =>
        `The booking window is ${min} to ${max} days`,
      windowNote:
        'A longer window opens more days at once. A shorter one does not remove bookings already made.',
      rules: 'House rules',
      rulesPlaceholder:
        'For example: Clean up after yourself. Quiet after 22:00.',
      rulesNote: 'Shown to the apartments above the times and limits.',
      saved: 'Saved.',
      changePassword: 'Change password',
      windowSummary: (name: string, days: number) =>
        `${name} · ${days} days ahead`,
      noRules: 'No rules yet',
      pages: 'Association pages',
      currentPassword: 'Current password',
      newPassword: 'New password',
      repeatPassword: 'New password again',
      passwordNote: 'Every other device is signed out when you change it.',
      wrongPassword: 'The current password is wrong',
      passwordTooShort: (min: number) =>
        `The new password must be at least ${min} characters`,
      passwordTooLong: (max: number) =>
        `The new password can have at most ${max} characters`,
      passwordsDiffer: 'The new passwords do not match',
      passwordChanged:
        'The password has been changed. Every other device has been signed out.',
    },
    schedule: {
      noSlots: 'Add at least one slot',
      timeFormat: 'Enter times as 08:00',
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
      showAllEnded: (count: number) => `Show all ${count} ended`,
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
