// Rejects with the message when the promise has not settled within ms. The
// promise itself runs on, so whatever it holds needs its own way to stop.
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(message));
      }, ms);
    }),
  ]).finally(() => {
    clearTimeout(timer);
  });
}
