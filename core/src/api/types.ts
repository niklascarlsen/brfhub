import type {components} from '../generated/api';

export type Booking = components['schemas']['Booking'];
export type Slot = components['schemas']['Slot'];
// A resource's slots for a day or range, and what the apartment holds of its kind.
export type Slots = components['schemas']['Slots'];
export type BookingWindow = components['schemas']['BookingWindow'];
export type Resource = components['schemas']['Resource'];
export type Apartment = components['schemas']['Apartment'];
export type AdminResources = components['schemas']['AdminResources'];
export type AdminResource = components['schemas']['AdminResource'];
export type AdminKind = components['schemas']['AdminKind'];
// Text the organization writes once per language it uses.
export type LocalizedText = components['schemas']['LocalizedText'];
export type LocalizedTags = components['schemas']['LocalizedTags'];
export type SlotInput = components['schemas']['ScheduleSlot'];
export type Announcement = components['schemas']['Announcement'];
export type AdminAnnouncement = components['schemas']['AdminAnnouncement'];
export type Subscription = components['schemas']['Subscription'];
// What an apartment holds of a kind, and the bookings that count.
export type Held = components['schemas']['Held'];
export type HeldBooking = components['schemas']['HeldBooking'];
// Who signed in: a resident, an admin of the organization, or both.
export type Account = components['schemas']['Account'];
