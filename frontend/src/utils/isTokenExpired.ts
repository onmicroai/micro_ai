/**
 * Checks if token is expired or not
 *
 * @returns {Boolean}
 */
const isTokenExpired = (expirationTime: string | null): boolean => {
   if (expirationTime === null) {
     return true;
   }

   // Convert Unix timestamp to milliseconds and create Date object
   const expirationDate = new Date(parseFloat(expirationTime) * 1000);
   const currentTime = new Date();
   const isExpired = currentTime > expirationDate;
   
   return isExpired;
};

export default isTokenExpired;
