/**
 * Checks if token is expired or not
 *
 * @returns {Boolean}
 */
const isTokenExpired = (expirationTime: string | null): boolean => {
   if (expirationTime === null) {
     return true;
   }

   // Create Date object directly from ISO string
   const expirationDate = new Date(expirationTime);
   const currentTime = new Date();
   const isExpired = currentTime > expirationDate;
   
   return isExpired;
};

export default isTokenExpired;
