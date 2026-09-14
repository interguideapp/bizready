/**
 * Where an item is acted on — one answer per kind, shared by every surface.
 *
 * The board and the alerts list each decide their own href from their own
 * shape (an Obligation has a kind; an attention item has a dedupe key), and
 * that is fine. What is not fine is each holding its own string for the same
 * destination, because they had already diverged: the alerts list sent a
 * document expiry to /documents and the board sent it nowhere at all, leaving
 * the row that warns your cover lapses in five days as the only dead end on
 * the screen.
 *
 * A constant rather than a function: /documents reads no searchParams, so a
 * ?from= would be noise that makes one destination look like two.
 */

/** Where an expiring or expired document is replaced. */
export const DOCUMENT_EXPIRY_HREF = "/documents";

/** Where a broken invoicing connection is repaired. */
export const SYNC_ERROR_HREF = "/integrations";
