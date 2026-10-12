import type {components} from '../generated/api';

export type Booking = components['schemas']['Booking'];
export type Slot = components['schemas']['Slot'];
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
export type ActiveBooking = NonNullable<
  components['schemas']['Slots']['active']
>;
