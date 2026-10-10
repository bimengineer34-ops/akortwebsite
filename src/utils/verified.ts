/**
 * NO_FAKE_DATA politikası.
 *
 * Referans tasarımlarda görülen sayılar, iletişim bilgileri, sertifikalar vb. kullanıcı doğrulayana kadar
 * `verified: false` olarak tutulur. Doğrulanmamış değerler:
 *  - development'ta TODO işaretiyle görünür (layout kontrolü için),
 *  - production build'de hiç render edilmez.
 */
export interface Verifiable<T> {
  value: T;
  verified: boolean;
  /** Doğrulama notu / kaynağı (ör. "Referans görselden, doğrulanmadı") */
  note?: string | undefined;
}

export const unverified = <T>(value: T, note = 'Referans görselden alındı, doğrulanmadı'): Verifiable<T> => ({
  value,
  verified: false,
  note,
});

export const verified = <T>(value: T, note?: string): Verifiable<T> =>
  note === undefined ? { value, verified: true } : { value, verified: true, note };

const isDev = import.meta.env.DEV;

/** Değer yayınlanabilir mi? Production'da yalnızca doğrulanmış veriler. */
export const isPublishable = <T>(field: Verifiable<T> | undefined): field is Verifiable<T> =>
  field !== undefined && (field.verified || isDev);

/** Yayınlanabilir değeri döndürür, değilse `undefined`. */
export const publishable = <T>(field: Verifiable<T> | undefined): T | undefined =>
  isPublishable(field) ? field.value : undefined;
