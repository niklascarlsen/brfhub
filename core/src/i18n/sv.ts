// Every string the apartment and admin screens show, in Swedish. Both
// clients read this one file, so a key one client does not use is still
// fine here.
// How long until a new mailed code, in seconds or, from a minute, minutes.
function wait(seconds: number) {
  // A no-break space, so the number never wraps away from its unit.
  return seconds < 60
    ? `${seconds}\u00a0s`
    : `${Math.ceil(seconds / 60)}\u00a0min`;
}

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
    yesterday: 'Igår',
  },
  common: {
    retry: 'Försök igen',
    cancel: 'Avbryt',
    // Closes a question about removing or cancelling something, where
    // "Avbryt" would read as the action itself.
    keep: 'Behåll',
    ok: 'OK',
    appName: 'BrfHub',
    // Read by a screen reader as a dialog opens, after what it asks.
    dialogOptions: (labels: string[]) => `Alternativ: ${labels.join(', ')}`,
    email: 'E-post',
    loading: 'Laddar',
    showPassword: 'Visa lösenord',
    hidePassword: 'Dölj lösenord',
  },
  language: {
    heading: 'Språk',
    // Follows the device's language.
    system: 'System',
    // What the language is called in itself, for the picker.
    name: 'Svenska',
    // What each language is called in this one, inside a sentence.
    names: {sv: 'svenska', en: 'engelska'},
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
    CHANGE_TOO_EARLY:
      'Den dagen går inte att välja längre. Välj en senare dag.',
    CHANGE_CANCELS_BOOKINGS:
      'Någon hann boka under tiden. Försök igen så ser du vilka bokningar som avbokas.',
    ENDS_IN_PAST: 'Slutdagen har redan passerat',
    INVALID_SCHEDULE: 'Passen överlappar eller slutar innan de börjar',
    RESOURCE_OPEN: 'Stäng resursen innan du tar bort den',
    KIND_IN_USE: 'Typen används fortfarande av resurser',
    LANGUAGES_CHANGED:
      'Föreningens språk har ändrats sedan sidan öppnades. Ladda om och försök igen.',
    TWO_FACTOR_REQUIRED: 'Sätt upp tvåstegsverifiering först',
    LAST_ADMIN: 'Föreningen måste ha minst en administratör',
    OWN_ACCOUNT: 'Det går inte att göra med ditt eget konto',
    NOT_FOUND: 'Hittades inte',
    UNAUTHORIZED: 'Du är inte inloggad',
    FORBIDDEN: 'Det där får ditt konto inte göra',
    VALIDATION: 'Ogiltig förfrågan',
    NETWORK: 'Ingen kontakt med servern',
    TIMEOUT: 'Servern svarade inte i tid, försök igen',
    SERVER_ERROR: 'Något gick fel på servern, försök om en stund',
    RATE_LIMITED: 'För många försök, vänta en minut',
    UNKNOWN: 'Något gick fel',
  },
  login: {
    title: 'Logga in',
    intro: 'Ange din e-post för att fortsätta.',
    continue: 'Fortsätt',
    codeTitle: 'Ange koden',
    codeIntro: (email: string) =>
      `Vi har skickat en sexsiffrig kod till ${email}. Hittar du den inte, titta i skräpposten.`,
    code: 'Kod',
    wrongCode: 'Fel kod. Kontrollera mejlet och försök igen.',
    codeExpired: 'Koden har gått ut. Skicka en ny.',
    tooManyCodeAttempts: 'För många försök. Skicka en ny kod.',
    sendNewCode: 'Skicka ny kod',
    // Counted down from the last code, which goes out at most every half
    // minute and a few times an hour.
    sendNewCodeIn: (seconds: number) => `Skicka ny kod om ${wait(seconds)}`,
    // The hour's codes for the address are used up from this device.
    tooManyCodes: (seconds: number) =>
      `Du har bett om många koder. Försök igen om ${wait(seconds)}.`,
    codeSent: 'En ny kod är skickad.',
    changeEmail: 'Byt e-post',
    passwordTitle: 'Ange lösenordet',
    passwordIntro: (email: string) => `Lösenordet för ${email}.`,
    password: 'Lösenord',
    submit: 'Logga in',
    wrongCredentials: 'Fel e-post eller lösenord',
    tooManyAttempts: 'För många försök, vänta en stund',
    originRefused: 'Servern tillåter inte den här adressen',
    setPassword: 'Glömt lösenordet?',
    // The admin's second step after the password.
    totpTitle: 'Ange kod från din authenticator',
    totpIntro: 'Öppna din authenticator-app och skriv in koden den visar.',
    totpCode: 'Kod från appen',
    useBackupCode: 'Använd en backup-kod i stället',
    backupTitle: 'Ange en backup-kod',
    backupIntro:
      'En av koderna du fick när du satte upp din authenticator. Varje kod fungerar en gång.',
    backupCode: 'Backup-kod',
    useTotp: 'Använd authenticator-appen i stället',
    trustDevice: 'Lita på den här enheten i 30 dagar',
    startOver: 'Börja om',
    // Setting a password with a code from the mail.
    resetTitle: 'Välj ett lösenord',
    resetIntro: (email: string) =>
      `Vi har skickat en kod till ${email}. Skriv in den och välj ett lösenord.`,
    newPassword: 'Lösenord',
    repeatPassword: 'Lösenord igen',
    resetSubmit: 'Spara och logga in',
  },
  // The admin's authenticator app.
  twoFactor: {
    title: 'Sätt upp tvåstegsverifiering',
    intro:
      'Som admin loggar du in med lösenord och en kod från en authenticator-app, till exempel Google Authenticator, 1Password eller Lösenord på iPhone. Bekräfta lösenordet för att börja.',
    password: 'Lösenord',
    begin: 'Börja',
    scanTitle: 'Skanna koden',
    scanIntro:
      'Skanna QR-koden i din authenticator-app, eller skriv in nyckeln för hand. Skriv sedan in koden appen visar.',
    manualKey: 'Nyckel att skriva in',
    // What a screen reader says for the QR code, never the secret in it.
    qrCode: 'QR-kod för authenticator-appen',
    firstCode: 'Kod från appen',
    verify: 'Bekräfta',
    backupTitle: 'Spara dina backup-koder',
    backupIntro:
      'Tappar du telefonen loggar du in med en av de här koderna i stället. Varje kod fungerar en gång. Spara dem på ett säkert ställe, de visas bara nu.',
    copyCodes: 'Kopiera koderna',
    shareCodes: 'Dela koderna',
    copied: 'Koderna är kopierade',
    done: 'Klar',
    wrongPassword: 'Lösenordet stämmer inte',
    alreadyEnabled: 'Tvåstegsverifiering är redan på. Logga ut och in igen.',
    wrongCode: 'Fel kod. Vänta tills appen visar en ny och försök igen.',
    locked: 'För många fel. Vänta en kvart och försök igen.',
  },
  account: {
    heading: 'Konto',
    signedInAs: 'Inloggad som',
    signOut: 'Logga ut',
    signOutQuestion: (from: string) => `Vill du logga ut från ${from}?`,
    // Shown to an account that is both a resident and an admin.
    openAdmin: 'Administrera föreningen',
    openBooking: 'Till bokningen',
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
    done: 'Jag är klar',
    cancel: 'Avboka',
    dropIn: 'Drop-in',
    ended: 'Avslutad',
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
    alreadyHolding: (count: number) =>
      count === 1
        ? 'Du har redan en bokning'
        : `Du har redan ${count} bokningar`,
    swap: 'Byt',
    swapQuestion: 'Vill du byta din bokning mot den nya tiden?',
    swapFrom: 'Din bokning',
    swapTo: 'Ny tid',
    swapChoices: 'Dina bokningar',
    chooseSwapQuestion: 'Välj den du vill byta mot den nya tiden.',
    queueTitle: 'Ställ dig i kö',
    queueMe: 'Ställ mig i kö',
    queueQuestion: (when: string) =>
      `Vi meddelar dig om ${when} blir ledig. Först till kvarn gäller.`,
    leaveQueueQuestion: (when: string) => `Vill du lämna kön för ${when}?`,
    stayInQueue: 'Stanna i kön',
    cancelTitle: 'Avboka tid',
    cancelQuestion: (when: string) => `Vill du avboka ${when}?`,
    releaseTitle: 'Öppna för drop-in',
    releaseQuestion: (when: string) =>
      `Andra kan ta ${when} som drop-in. Du kan inte boka en ny tid förrän luckan är slut.`,
    fullUntilOver: (count: number): string =>
      count === 1
        ? 'Du kan inte boka en ny tid förrän luckan är slut.'
        : 'Du kan inte boka en ny tid förrän någon av dina luckor är slut.',
    freeSlots: (count: number) =>
      count === 1 ? '1 ledigt pass' : `${count} lediga pass`,
    previousDay: 'Föregående dag',
    nextDay: 'Nästa dag',
    noSlotsLeft: 'Inga tider kvar den här dagen',
    closedTitle: 'Tillfälligt stängd',
    closedMessage: 'Den går inte att boka just nu.',
    slotsOfDay: 'Tider den här dagen',
    chooseResource: 'Välj utrymme',
    greeting: (apartment: string) => `Hej, lägenhet ${apartment}`,
    nextTime: 'Din nästa tid',
    bookTitle: 'Boka tid',
    bookQuestion: (when: string) => `Vill du boka ${when}?`,
  },
  calendar: {
    chooseDay: 'Välj dag',
    noFreeSlots: 'inga lediga pass',
    yourTime: 'din tid',
    legendMine: 'Din tid',
    legendFull: 'Fullbokat',
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
    heading: 'Husregler',
    timesHeading: 'Bokningsbara tider',
    bookableDaysAhead: (days: number) => `${days} dagar framåt`,
    // "A, B och C": the names before the last one come already joined.
    joinList: (first: string, last: string) => `${first} och ${last}`,
    oneBooking: 'En bokning åt gången',
    oneBookingShared: 'En bokning åt gången, för alla tillsammans',
    upToBookings: (count: number) => `Upp till ${count} bokningar åt gången`,
    changesFrom: (day: string, times: string) => `Från ${day} ${times}`,
    closes: (day: string) => `Stängs ${day}`,
    closed: 'Tillfälligt stängd',
    // A closing and what the admin says about it.
    withNote: (closing: string, note: string) => `${closing}. ${note}`,
  },
  announcements: {
    heading: 'Anslag',
    hide: 'Dölj',
    // The day it went up, and where it is among those not hidden yet.
    withPosition: (day: string, index: number, count: number) =>
      `${day} · ${index} av ${count}`,
  },
  push: {
    // What Android lists in the app's notification settings.
    channel: 'Lediga tider',
    announcementsChannel: 'Anslag',
    promptTitle: 'Notiser',
    promptMessage:
      'Vill du få en notis när en tid du köar för blir ledig, och när styrelsen sätter upp ett anslag?',
    turnOn: 'Slå på',
    failedTitle: 'Kunde inte slå på notiser',
    failedMessage:
      'Tillåt notiser för den här appen i webbläsarens inställningar.',
    // The switch under the account.
    toggle: 'Notiser',
    toggleHint:
      'När en tid du köar för blir ledig, och när styrelsen sätter upp ett anslag.',
    blockedTitle: 'Notiser är avstängda',
    blockedMessage:
      'Du har sagt nej till notiser från appen. Slå på dem i telefonens inställningar.',
    openSettings: 'Öppna inställningar',
  },
  admin: {
    add: 'Lägg till',
    save: 'Spara',
    remove: 'Ta bort',
    details: 'Uppgifter',
    actions: 'Åtgärder',
    goneTitle: 'Finns inte längre',
    gone: 'Det kan ha tagits bort, eller så är länken gammal.',
    editDetails: 'Ändra uppgifter',
    // Said when an edited form is about to be left without saving.
    unsaved: {
      hint: 'Osparade ändringar',
      title: 'Lämna utan att spara?',
      message: 'Det du har ändrat sparas inte.',
      stay: 'Stanna kvar',
      leave: 'Lämna',
    },
    apartments: {
      newTitle: 'Ny lägenhet',
      newNote: 'De boende får ett mejl om hur de loggar in, när du har sparat.',
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
      signOut: 'Logga ut överallt',
      signOutHint: 'När en telefon har försvunnit',
      signOutQuestion: (label: string) =>
        `Lägenhet ${label} loggas ut på alla enheter. De boende loggar in igen med en ny kod från mejlet.`,
      signOutFailed: 'Kunde inte logga ut lägenheten',
      remove: 'Ta bort lägenheten',
      removeQuestion: (cancelNote: string) =>
        `${cancelNote} Kontot tas bort och numret kan användas igen.`,
      removeFailed: 'Kunde inte ta bort lägenheten',
      editNote:
        'Ändras e-posten loggas lägenheten ut, och den nya adressen får ett mejl om hur man loggar in.',
      newResidentNote: (cancelNote: string) =>
        `${cancelNote} Det gamla kontot tas bort och de nya boende får ett mejl om hur de loggar in.`,
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
      editTimesHint: (day: string) => `Inga bokningar påverkas från ${day}`,
      editDetailsHint: 'Namn, typ och taggar',
      moveUp: 'Flytta upp',
      moveDown: 'Flytta ner',
      moveFailed: 'Kunde inte flytta resursen',
      removeChange: 'Ta bort ändringen',
      removeChangeQuestion: (day: string) =>
        `Tiderna från ${day} tas bort, och de nuvarande gäller vidare.`,
      removeChangeFailed: 'Kunde inte ta bort ändringen',
      close: 'Stäng resursen',
      closeHint: 'Från en dag du väljer, till exempel vid ett fel',
      reopen: 'Öppna igen',
      undoClose: 'Ångra stängningen',
      reopenFailed: 'Kunde inte öppna resursen',
      remove: 'Ta bort resursen',
      removableFrom: (day: string) =>
        `Kan tas bort från ${day}, när den har stängt.`,
      removeQuestion: (name: string) =>
        `${name} tas bort för gott, med sina tider och gamla bokningar. Det går inte att ångra.`,
      removeFailed: 'Kunde inte ta bort resursen',
      undoCloseFailed: 'Kunde inte ångra stängningen',
    },
    resourceForm: {
      name: 'Namn, t.ex. Tvättstuga 1',
      tags: 'Taggar, åtskilda med komma',
      slots: 'Pass',
    },
    kindForm: {
      name: 'Namn, t.ex. Tvätt',
      limit: 'Bokningar åt gången',
      limitHint: 'Per lägenhet, för alla resurser av typen tillsammans',
      limitNote:
        'Den lägre gränsen gäller nya bokningar. Lägenheter som redan har fler behåller dem.',
      fewer: 'Färre',
      more: 'Fler',
      remove: 'Ta bort typen',
    },
    scheduleForm: {
      from: 'Gäller från',
      save: 'Spara tiderna',
    },
    closeForm: {
      from: 'Stängd från',
      note: (name: string) =>
        `${name} går att boka till och med dagen före. Öppna den igen när du vill.`,
      save: 'Stäng resursen',
    },
    // What a change of times or a closing does to the bookings already
    // made.
    change: {
      noCancels: 'Inga bokningar påverkas.',
      mayCancel: (day: string) =>
        `Bokningar som påverkas avbokas, och du ser vilka innan något sparas. Från ${day} påverkas inga.`,
      reason: 'Meddelande till dem som avbokas',
      reasonHint: 'Skickas med i mejlet och notisen. Valfritt.',
      note: 'Meddelande till de boende',
      noteHint:
        'Visas på den stängda resursen och skickas till dem som avbokas. Valfritt.',
      cancelTitle: (count: number) =>
        count === 1 ? 'En bokning avbokas' : `${count} bokningar avbokas`,
      cancelLine: (apartment: string, when: string) =>
        `Lgh ${apartment}: ${when}`,
      cancelMore: (count: number) => `och ${count} till`,
      told: (apartments: number): string =>
        apartments === 1
          ? 'Lägenheten får ett mejl och en notis om det.'
          : 'Lägenheterna får ett mejl och en notis om det.',
      cancelAndSave: 'Avboka och spara',
      cancelAndClose: 'Avboka och stäng',
      cancelAndRemove: 'Avboka och ta bort',
    },
    slots: {
      starts: 'Börjar',
      ends: 'Slutar',
      endsNextDay: 'Slutar nästa dag',
      add: 'Lägg till pass',
    },
    // Said at a field while it is being filled in.
    field: {
      required: 'Måste fyllas i',
      tooLong: (length: number, max: number) =>
        `För lång, ${length} av högst ${max} tecken`,
      tagTooLong: (max: number) => `En tagg får ha högst ${max} tecken`,
      tooManyTags: (max: number) => `Högst ${max} taggar`,
      // The server refused what the fields allowed.
      rejected:
        'Servern godtog inte uppgifterna. Kontrollera fälten och försök igen.',
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
      mail: 'Skicka även som e-post',
      mailHint: 'Till alla boende. För viktig information som alla behöver se.',
    },
    // Text the organization writes in each of its languages.
    localized: {
      label: (label: string, language: string) => `${label} (${language})`,
      untranslated: (languages: string) => `Saknar ${languages}`,
      tagsInEvery: 'Skriv taggar på alla språk, eller lämna alla tomma.',
      rulesInEvery: 'Skriv reglerna på alla språk, eller lämna alla tomma.',
      reasonInEvery: 'Skriv meddelandet på alla språk, eller lämna alla tomma.',
      // The bar every admin page shows while something lacks a language,
      // such as "2 resurser och ordningsreglerna".
      missing: (languages: string, what: string) =>
        `Inte översatt till ${languages} än: ${what}.`,
      kinds: (count: number) => (count === 1 ? '1 typ' : `${count} typer`),
      resources: (count: number) =>
        count === 1 ? '1 resurs' : `${count} resurser`,
      announcements: (count: number) =>
        count === 1 ? '1 anslag' : `${count} anslag`,
      rules: 'ordningsreglerna',
    },
    admins: {
      title: 'Administratörer',
      note: 'Alla administratörer kan allt här. Den som läggs till får ett mejl om hur de loggar in.',
      add: 'Lägg till administratör',
      name: 'Namn',
      you: 'du',
      lives: (label: string) => `Bor i lägenhet ${label}`,
      count: (count: number) =>
        count === 1 ? '1 administratör' : `${count} administratörer`,
      withoutTwoFactor: (count: number) => `${count} utan tvåsteg`,
      twoFactorMissing: 'Inget tvåsteg än',
      apartment: 'Lägenhet',
      twoFactor: 'Tvåstegsverifiering',
      twoFactorOn: 'Uppsatt',
      twoFactorOff: 'Inte uppsatt än',
      resetHint: 'När en telefon har försvunnit',
      removeAdmin: 'Ta bort som administratör',
      lastSignIn: (when: string) => `Senast inloggad ${when}`,
      never: 'Har aldrig loggat in',
      removeQuestion: (email: string) =>
        `${email} loggas ut och kan inte längre administrera föreningen. Bor personen här behåller de sin lägenhet.`,
      removeFailed: 'Kunde inte ta bort administratören',
      resetTwoFactor: 'Nollställ tvåstegsverifiering',
      resetQuestion: (email: string) =>
        `${email} loggas ut överallt och sätter upp en ny authenticator vid nästa inloggning. Gör det när en telefon har försvunnit.`,
      reset: 'Nollställ',
      resetFailed: 'Kunde inte nollställa',
      checkEmail: 'Kontrollera e-postadressen',
    },
    events: {
      title: 'Historik',
      note: 'Vad administratörerna har gjort, senaste först. Historiken sparas i 12 månader.',
      none: 'Inget har hänt det senaste året.',
      noneIn: 'Inget här det senaste året.',
      older: 'Visa äldre',
      filter: 'Visa',
      all: 'Allt',
      areas: {
        apartments: 'Lägenheter',
        resources: 'Resurser',
        announcements: 'Anslag',
        admins: 'Administratörer',
        organization: 'Inställningar',
      },
      actions: {
        'apartment.create': (subject: string) =>
          `Lade till lägenhet ${subject}`,
        'apartment.update': (subject: string) => `Ändrade lägenhet ${subject}`,
        'apartment.newResident': (subject: string) =>
          `Bytte boende i lägenhet ${subject}`,
        'apartment.signOut': (subject: string) =>
          `Loggade ut lägenhet ${subject} överallt`,
        'apartment.remove': (subject: string) => `Tog bort lägenhet ${subject}`,
        'admin.add': (subject: string) =>
          `Lade till ${subject} som administratör`,
        'admin.remove': (subject: string) =>
          `Tog bort ${subject} som administratör`,
        'admin.resetTwoFactor': (subject: string) =>
          `Nollställde tvåstegsverifiering för ${subject}`,
        'kind.create': (subject: string) => `Lade till typen ${subject}`,
        'kind.update': (subject: string) => `Ändrade typen ${subject}`,
        'kind.remove': (subject: string) => `Tog bort typen ${subject}`,
        'resource.create': (subject: string) => `Lade till ${subject}`,
        'resource.update': (subject: string) => `Ändrade ${subject}`,
        'resource.order': () => 'Ändrade ordningen på resurserna',
        'resource.close': (subject: string) => `Stängde ${subject}`,
        'resource.reopen': (subject: string) => `Öppnade ${subject} igen`,
        'resource.remove': (subject: string) => `Tog bort ${subject}`,
        'schedule.put': (subject: string) => `Ändrade schemat för ${subject}`,
        'schedule.remove': (subject: string) =>
          `Tog bort schemat för ${subject}`,
        'booking.cancel': (subject: string) =>
          `Avbokade bokningar för lägenheter i ${subject}`,
        'announcement.create': (subject: string) =>
          `Publicerade anslaget ${subject}`,
        'announcement.mail': (subject: string) =>
          `Mejlade anslaget ${subject} till alla boende`,
        'announcement.update': (subject: string) =>
          `Ändrade anslaget ${subject}`,
        'announcement.remove': (subject: string) =>
          `Tog bort anslaget ${subject}`,
        'organization.update': (subject: string) =>
          `Ändrade inställningarna: ${subject}`,
      },
      // What a change to the settings touched, as the subject of
      // 'organization.update'.
      settingsParts: {
        name: 'namnet',
        bookingWindowDays: 'bokningsfönstret',
        locales: 'språken',
        rulesText: 'ordningsreglerna',
      },
    },
    organization: {
      languages: 'Föreningens språk',
      languagesNote:
        'Lägenheterna kan välja bland språken som är på. Med flera språk skriver du föreningens texter på vart och ett. Det som inte är översatt visas på det språk det är skrivet på.',
      name: 'Föreningens namn',
      windowDays: 'Bokningsbart antal dagar framåt',
      windowRange: (min: number, max: number) =>
        `Bokningsfönstret är ${min} till ${max} dagar`,
      windowNote:
        'Ett längre fönster öppnar fler dagar direkt. Ett kortare tar inte bort bokningar som redan är gjorda.',
      rules: 'Ordningsregler',
      rulesPlaceholder: 'Till exempel: Städa efter dig. Tyst efter klockan 22.',
      rulesNote: 'Visas för lägenheterna ovanför tiderna och gränserna.',
      saved: 'Sparat.',
      changePassword: 'Byt lösenord',
      windowSummary: (name: string, days: number) =>
        `${name} · ${days} dagar framåt`,
      noRules: 'Inga ordningsregler än',
      pages: 'Föreningens sidor',
      currentPassword: 'Nuvarande lösenord',
      newPassword: 'Nytt lösenord',
      repeatPassword: 'Nytt lösenord igen',
      passwordNote: 'Alla andra enheter loggas ut när du byter.',
      wrongPassword: 'Det nuvarande lösenordet stämmer inte',
      passwordTooShort: (min: number) =>
        `Det nya lösenordet måste ha minst ${min} tecken`,
      passwordTooLong: (max: number) =>
        `Det nya lösenordet får ha högst ${max} tecken`,
      passwordsDiffer: 'De nya lösenorden är inte lika',
      passwordChanged: 'Lösenordet är bytt. Alla andra enheter har loggats ut.',
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
      showAllEnded: (count: number) => `Visa alla ${count} avslutade`,
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
