// Every string the apartment and admin screens show, in Swedish. The same
// file lives in app/ and web/, and web's check keeps the two identical, so
// a key one client does not use is still fine here.
export const sv = {
  dates: {
    // The locale toLocaleDateString writes long dates in.
    locale: 'sv-SE',
    weekdays: ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'],
    months: [
      'jan',
      'feb',
      'mar',
      'apr',
      'maj',
      'jun',
      'jul',
      'aug',
      'sep',
      'okt',
      'nov',
      'dec',
    ],
    today: 'Idag',
    tomorrow: 'Imorgon',
  },
  common: {
    retry: 'Försök igen',
    cancel: 'Avbryt',
    ok: 'OK',
    email: 'E-post',
    loading: 'Laddar',
  },
  language: {
    heading: 'Språk',
    // Follows the device's language.
    system: 'System',
    // What the language is called in itself, for the picker.
    name: 'Svenska',
  },
  errors: {
    HAS_ACTIVE_BOOKING: 'Du har redan en bokning',
    SLOT_TAKEN: 'Tiden är redan bokad',
    SLOT_IN_PAST: 'Tiden har redan passerat',
    SLOT_STARTED: 'Tiden har börjat, drop-in gäller',
    OUTSIDE_BOOKING_WINDOW: 'Den dagen går inte att boka än',
    SLOT_AVAILABLE: 'Tiden är ledig, boka den istället',
    APARTMENT_TAKEN: 'Det finns redan en lägenhet med det numret',
    EMAIL_TAKEN: 'E-postadressen används redan av ett annat konto',
    CHANGE_INSIDE_WINDOW:
      'Ändringen kan inte börja innan bokningsfönstret har passerat',
    ENDS_IN_PAST: 'Slutdagen har redan passerat',
    INVALID_SCHEDULE: 'Passen överlappar eller slutar innan de börjar',
    KIND_IN_USE: 'Typen används fortfarande av resurser',
    NOT_FOUND: 'Hittades inte',
    UNAUTHORIZED: 'Du är inte inloggad',
    FORBIDDEN: 'Det där är inte din bokning',
    VALIDATION: 'Ogiltig förfrågan',
    NETWORK: 'Ingen kontakt med servern',
    TIMEOUT: 'Servern svarade inte i tid, försök igen',
    SERVER_ERROR: 'Något gick fel på servern, försök om en stund',
    UNKNOWN: 'Något gick fel',
  },
  login: {
    title: 'Logga in',
    intro: 'Med e-posten för lägenheten eller föreningens admin.',
    password: 'Lösenord',
    submit: 'Logga in',
    wrongCredentials: 'Fel e-post eller lösenord',
    tooManyAttempts: 'För många försök, vänta en stund',
    originRefused: 'Servern tillåter inte den här adressen',
  },
  account: {
    heading: 'Konto',
    signedInAs: 'Inloggad som',
    signOut: 'Logga ut',
    signOutQuestion: (from: string) => `Vill du logga ut från ${from}?`,
    noApartmentTitle: 'Kontot saknar lägenhet',
    noApartmentMessage:
      'Ditt konto är inte kopplat till någon lägenhet. Kontakta styrelsen.',
    nothingToBookTitle: 'Inget att boka',
    nothingToBookMessage: 'Det finns inga utrymmen att boka just nu.',
  },
  apartment: {
    title: (label: string) => `Lägenhet ${label}`,
    signOutFrom: (label: string) => `lägenhet ${label}`,
    backToBooking: 'Till bokningen',
  },
  times: {
    emptyTitle: 'Här var det tomt.',
    emptyMessage:
      'När du tar en lucka eller ställer dig i kö dyker den upp här.',
    bookings: 'Bokningar',
    queue: 'Reserv',
    ended: 'Avslutad',
    done: 'Jag är klar',
    cancel: 'Avboka',
    dropIn: 'Drop-in',
    freeNow: 'Ledig nu',
    book: 'Boka',
    leaveQueue: 'Lämna kön',
  },
  booking: {
    bookFailed: 'Kunde inte boka',
    queueFailed: 'Kunde inte köa',
    leaveQueueFailed: 'Kunde inte lämna kön',
    cancelFailed: 'Kunde inte avboka',
    releaseFailed: 'Kunde inte öppna tiden',
    alreadyBookedTitle: 'Du har redan en bokning',
    swap: 'Byt',
    swapQuestion: (when: string) => `Vill du byta till ${when}?`,
    queueTitle: 'Ställ dig i kö',
    queueMe: 'Ställ mig i kö',
    queueQuestion: (when: string) =>
      `Vi meddelar dig om ${when} blir ledig. Först till kvarn gäller.`,
    leaveQueueQuestion: (when: string) => `Vill du lämna kön för ${when}?`,
    cancelTitle: 'Avboka tid',
    cancelQuestion: (when: string) => `Vill du avboka ${when}?`,
    releaseTitle: 'Öppna för drop-in',
    releaseQuestion: (when: string) =>
      `Andra kan ta ${when} som drop-in. Du kan inte boka en ny tid förrän luckan är slut.`,
    releasedBlocks: 'Du kan inte boka en ny tid förrän luckan är slut.',
    freeSlots: (count: number) =>
      count === 1 ? '1 ledigt pass' : `${count} lediga pass`,
    previousDay: 'Föregående dag',
    nextDay: 'Nästa dag',
    noSlotsLeft: 'Inga tider kvar den här dagen',
    slotsOfDay: 'Tider den här dagen',
    chooseResource: 'Välj utrymme',
    greeting: (apartment: string) => `Hej, lägenhet ${apartment}`,
    nextTime: 'Din nästa tid',
    bookTitle: 'Boka tid',
    bookQuestion: (when: string) => `Vill du boka ${when}?`,
  },
  calendar: {
    chooseDay: 'Välj dag',
    full: 'fullt',
    noFreeSlots: 'inga lediga pass',
    yourTime: 'din tid',
    legend: 'Siffran är lediga pass i alla utrymmen.',
  },
  slots: {
    mine: 'Din tid',
    freeNow: 'Ledig nu',
    free: 'Ledig',
    dropIn: 'Drop-in',
    queued: 'I kö',
    taken: 'Upptagen',
  },
  rules: {
    heading: 'Regler',
    bookableDaysAhead: (days: number) => `Bokningsbart ${days} dagar framåt`,
    // "A, B och C": the names before the last one come already joined.
    joinList: (first: string, last: string) => `${first} och ${last}`,
    oneBooking: 'En bokning åt gången',
    oneBookingShared: 'En bokning åt gången, för alla tillsammans',
    upToBookings: (count: number) => `Upp till ${count} bokningar åt gången`,
    changesFrom: (day: string, times: string) => `Från ${day} ${times}`,
    closes: (day: string) => `Stängs ${day}`,
  },
  announcements: {
    heading: 'Anslag',
    hide: 'Dölj',
  },
  push: {
    // What Android lists in the app's notification settings.
    channel: 'Lediga tider',
    promptTitle: 'Notiser',
    promptMessage: 'Vill du få en notis när en tid du köar för blir ledig?',
    turnOn: 'Slå på',
    failedTitle: 'Kunde inte slå på notiser',
    failedMessage:
      'Tillåt notiser för den här appen i webbläsarens inställningar.',
  },
  admin: {
    add: 'Lägg till',
    save: 'Spara',
    remove: 'Ta bort',
    details: 'Uppgifter',
    actions: 'Åtgärder',
    editDetails: 'Ändra uppgifter',
    apartments: {
      newTitle: 'Ny lägenhet',
      newNote:
        'Lägenheten får ett lösenord som visas en gång, efter att du har sparat.',
      addApartment: 'Lägg till lägenhet',
      none: 'Inga lägenheter än. Lägg till den första.',
      search: 'Sök nummer, namn eller e-post',
      noMatch: 'Ingen lägenhet matchar.',
      count: (count: number) =>
        count === 1 ? '1 lägenhet' : `${count} lägenheter`,
    },
    apartment: {
      // Said before anything that cancels the apartment's bookings, since
      // those are times someone else is counting on.
      cancelNote: (upcoming: number) => {
        if (upcoming === 0) {
          return 'Lägenheten har inga kommande bokningar.';
        }

        const bookings =
          upcoming === 1
            ? '1 kommande bokning'
            : `${upcoming} kommande bokningar`;

        return `Lägenhetens ${bookings} avbokas, och den som köar får en notis.`;
      },
      resetPassword: 'Återställ lösenord',
      resetPasswordHint: 'När de boende har glömt det',
      resetQuestion: (label: string) =>
        `Lägenhet ${label} får ett nytt lösenord och loggas ut på alla enheter.`,
      reset: 'Återställ',
      resetFailed: 'Kunde inte återställa lösenordet',
      remove: 'Ta bort lägenheten',
      removeQuestion: (cancelNote: string) =>
        `${cancelNote} Kontot tas bort och numret kan användas igen.`,
      removeFailed: 'Kunde inte ta bort lägenheten',
      editNote:
        'Ändras e-posten loggas lägenheten ut och loggar in med den nya adressen.',
      newResidentNote: (cancelNote: string) =>
        `${cancelNote} Det gamla kontot tas bort och de nya boende får ett eget lösenord.`,
      replaceResident: 'Byt boende',
      never: 'Aldrig',
      resident: 'Boende',
      lastSignIn: 'Senast inloggad',
      upcomingBookings: 'Kommande bokningar',
      editDetailsHint: 'Nummer, namn och e-post',
      newResident: 'Ny boende',
      newResidentHint: 'När lägenheten byter ägare',
    },
    resources: {
      newKind: 'Ny typ',
      newResource: 'Ny resurs',
      edit: 'Ändra',
      closed: 'Stängd',
      newTimes: (day: string) => `Nya tider ${day}`,
      noSlots: 'Inga pass',
      removeKindFailed: 'Kunde inte ta bort typen',
      startWithKind:
        'Börja med en typ, som Tvätt eller Bastu. Typen bestämmer hur många bokningar en lägenhet får ha åt gången.',
      noneOfKind: 'Inga resurser av den här typen.',
    },
    resource: {
      times: 'Tider',
      now: 'Nu',
      from: (day: string) => `Från ${day}`,
      closedSince: (day: string) => `Stängd sedan ${day}`,
      kind: 'Typ',
      tags: 'Taggar',
      editTimes: 'Ändra tider',
      editTimesHint: (day: string) =>
        `Gäller från ${day}, efter bokningsfönstret`,
      editDetailsHint: 'Namn, typ och taggar',
      moveUp: 'Flytta upp',
      moveDown: 'Flytta ner',
      moveFailed: 'Kunde inte flytta resursen',
      removeChange: 'Ta bort ändringen',
      removeChangeQuestion: (day: string) =>
        `Tiderna från ${day} tas bort, och de nuvarande gäller vidare.`,
      removeChangeFailed: 'Kunde inte ta bort ändringen',
      close: 'Stäng resursen',
      closeAction: 'Stäng',
      closeQuestion: (name: string, day: string) =>
        `${name} går att boka till och med dagen före ${day}. Bokningar fram till dess står kvar.`,
      closeFailed: 'Kunde inte stänga resursen',
      reopen: 'Öppna igen',
      undoClose: 'Ångra stängningen',
      reopenFailed: 'Kunde inte öppna resursen',
      undoCloseFailed: 'Kunde inte ångra stängningen',
    },
    resourceForm: {
      name: 'Namn, till exempel Tvättstuga 1',
      tags: 'Taggar, åtskilda med komma',
      slots: 'Pass',
    },
    kindForm: {
      name: 'Namn, till exempel Tvätt',
      limit: 'Bokningar åt gången',
      limitHint: 'Per lägenhet, för alla resurser av typen tillsammans',
      limitNote:
        'En ändrad gräns gäller nya bokningar. De som redan är gjorda står kvar.',
      fewer: 'Färre',
      more: 'Fler',
      remove: 'Ta bort typen',
    },
    scheduleForm: {
      note: (day: string) =>
        `De nya tiderna gäller från ${day}. Tiden fram till dess går redan att boka, så de bokningarna står kvar.`,
      save: 'Spara tiderna',
    },
    slots: {
      starts: 'Börjar',
      ends: 'Slutar',
      // The phone puts the switch on a row of its own, the web next to the
      // times, so the phone says more.
      endsNextDay: 'Slutar nästa dag',
      nextDay: 'Nästa dag',
      add: 'Lägg till pass',
    },
    apartmentForm: {
      number: 'Lägenhetsnummer',
      residentName: 'De boendes namn',
      checkEmail: 'Kontrollera e-postadressen',
    },
    announcementForm: {
      title: 'Rubrik',
      body: 'Text',
      shownFor: 'Visas',
      shown: (from: string, to: string | null) =>
        to ? `Från ${from} till och med ${to}.` : `Från ${from}.`,
    },
    organization: {
      settings: 'Inställningar',
      name: 'Föreningens namn',
      windowDays: 'Bokningsbart antal dagar framåt',
      windowRange: (max: number) => `Bokningsfönstret är 1 till ${max} dagar`,
      windowNote:
        'Ett längre fönster öppnar fler dagar direkt. Ett kortare tar inte bort bokningar som redan är gjorda.',
      rules: 'Ordningsregler',
      rulesPlaceholder: 'Till exempel: Städa efter dig. Tyst efter klockan 22.',
      rulesNote: 'Visas för lägenheterna ovanför tiderna och gränserna.',
      saved: 'Sparat.',
      changePassword: 'Byt lösenord',
      currentPassword: 'Nuvarande lösenord',
      newPassword: 'Nytt lösenord',
      repeatPassword: 'Nytt lösenord igen',
      passwordNote:
        'Byt lösenord när styrelsen byts. Alla andra enheter loggas ut.',
      wrongPassword: 'Det nuvarande lösenordet stämmer inte',
      passwordTooShort: (min: number) =>
        `Det nya lösenordet måste ha minst ${min} tecken`,
      passwordTooLong: 'Det nya lösenordet är för långt',
      passwordsDiffer: 'De nya lösenorden är inte lika',
      passwordChanged: 'Lösenordet är bytt. Alla andra enheter har loggats ut.',
    },
    password: {
      title: (label: string) => `Lösenord för lägenhet ${label}`,
      // Around the email address, which is shown highlighted between them.
      beforeEmail:
        'Visas bara nu. Ge det till de boende tillsammans med e-postadressen',
      afterEmail: '. De loggar in med båda.',
      login: (label: string, email: string, password: string) =>
        `Inloggning för lägenhet ${label}\nE-post: ${email}\nLösenord: ${password}`,
      share: 'Dela inloggningen',
      copy: 'Kopiera inloggningen',
      copied: 'Inloggningen kopierad',
      copyFailed:
        'Det gick inte att kopiera här. Markera lösenordet och kopiera det själv.',
      done: 'Klar',
    },
    schedule: {
      noSlots: 'Lägg till minst ett pass',
      timeFormat: 'Skriv tiderna som 08:00',
      endsBeforeStart:
        'Ett pass slutar innan det börjar. Slutar det efter midnatt, välj nästa dag.',
    },
    announcements: {
      untilFurther: 'Tills vidare',
      oneWeek: '1 vecka',
      twoWeeks: '2 veckor',
      oneMonth: '1 månad',
      new: 'Nytt anslag',
      publish: 'Publicera',
      active: 'Visas nu',
      scheduled: 'Kommande',
      ended: 'Avslutade',
      period: (from: string, to: string) => `${from} till ${to}`,
      openPeriod: (from: string) => `Från ${from}, tills vidare`,
      remove: 'Ta bort anslaget',
      removeQuestion: (title: string) =>
        `”${title}” tas bort och visas inte längre.`,
      removeFailed: 'Kunde inte ta bort anslaget',
      none: 'Inga anslag än. Ett anslag visas överst för alla lägenheter, till exempel om en städdag eller ett stopp i tvättstugan.',
    },
  },
  tabs: {
    book: 'Boka',
    myTimes: 'Mina tider',
    apartment: 'Lägenhet',
    apartments: 'Lägenheter',
    resources: 'Resurser',
    announcements: 'Anslag',
    organization: 'Föreningen',
    mainMenu: 'Huvudmeny',
  },
};
