/**
 * Single source of truth for public business contact details.
 * Used by the floating WhatsApp button, header banner, footer and contact page.
 */

/** Local (Pakistan) display format — what customers expect to see. */
export const PHONE_DISPLAY = "0337 3975015";

/** E.164 format for tel: links. */
export const PHONE_TEL = "+923373975015";

/** Digits-only format required by wa.me links (no + or spaces). */
export const WHATSAPP_NUMBER = "923373975015";

export const CONTACT_EMAIL = "contact@kifayat.co";

export const CONTACT_HOURS = "Mon–Sat, 9 am–9 pm";

export const CONTACT_ADDRESS = "Pakistan — nationwide delivery";

/** Prefilled message shown when a customer taps any WhatsApp link. */
export const WHATSAPP_MESSAGE = "Hi Kifayat! I have a question about an order.";

/** Ready-to-use wa.me href with the prefilled message. */
export function whatsappHref(message: string = WHATSAPP_MESSAGE): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
