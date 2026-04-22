/**
 * Firebase timeout configuration
 */
export const FIREBASE_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Custom error class for Firebase timeout
 */
export class FirebaseTimeoutError extends Error {
  constructor(message: string = 'Firebase request timeout') {
    super(message);
    this.name = 'FirebaseTimeoutError';
  }
}

/**
 * Wraps a promise with a 15-second timeout
 * Throws error after 15 seconds without retry
 * @param promise - The promise to wrap with timeout
 * @param operationName - Name of the operation (for logging)
 * @returns The result of the promise or throws error after timeout
 */
export async function withFirebaseTimeout<T>(
  promise: Promise<T>,
  operationName: string = 'Firebase operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        const timeoutError = new FirebaseTimeoutError(
          `${operationName} exceeded ${FIREBASE_TIMEOUT_MS}ms timeout`
        );
        console.error('[Firebase Timeout - Error Thrown]', {
          operation: operationName,
          timeoutMs: FIREBASE_TIMEOUT_MS,
          error: timeoutError.message,
        });
        reject(timeoutError);
      }, FIREBASE_TIMEOUT_MS)
    ),
  ]);
}
