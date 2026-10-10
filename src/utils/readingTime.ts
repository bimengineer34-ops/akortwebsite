const WORDS_PER_MINUTE = 200;

/** Ham markdown gövdesinden okuma süresi (dakika, en az 1). */
export const readingTime = (body: string | undefined): number => {
  if (!body) return 1;
  const words = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
};
