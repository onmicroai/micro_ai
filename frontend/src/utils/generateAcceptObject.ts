type AcceptObject = {
   [mimeType: string]: string[];
};

/**
 * Generates an accept object for file input.
 * @param input - The input string.
 * @returns The accept object.
 */
export const generateAcceptObject = (input: string): AcceptObject => {
   if (!input) {
      return {};
   }
   const mimeMap: { [key: string]: string } = {
      jpeg: "image/*",
      jpg: "image/*",
      png: "image/png",
      pdf: "application/pdf",
      html: "text/html",
      htm: "text/html",
   };

   const formats = input
      .split(/[\s,]+/)
      .map((format) => format.trim())
      .filter(Boolean);

   const acceptObject: AcceptObject = {};

   formats.forEach((format) => {
      const cleanFormat = format.startsWith(".") ? format.slice(1) : format;

      const mimeType = mimeMap[cleanFormat] || "*/*";

      if (!acceptObject[mimeType]) {
         acceptObject[mimeType] = [];
      }
      acceptObject[mimeType].push(`.${cleanFormat}`);
   });

   return acceptObject;
};