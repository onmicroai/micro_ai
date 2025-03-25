/**
 * Creates a promise that resolves after a specified number of milliseconds.
 * @param ms The number of milliseconds to delay.
 * @returns A promise that resolves after the specified delay.
 */
const delay = (ms: number): Promise<void> => {
   return new Promise(resolve => setTimeout(resolve, ms));
 };

export default delay;