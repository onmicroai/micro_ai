import React, { useState, useEffect, useRef } from 'react';
import { FaX as X, FaCopy as Copy } from 'react-icons/fa6';
import { ShareModalProps } from '@/app/(authenticated)/(dashboard)/types';
/**
 * AppItem component renders an individual app with actions such as sharing and cloning.
 * 
 * @param {ShareModalProps} props - The properties for the AppItem component.
 * @returns {JSX.Element} The rendered AppItem component.
 */
const ShareModal: React.FC<ShareModalProps> = ({ app, showModal, setShowModal }) => {
   const hashId = app.hashId;
   const [showShareMenu, setShowShareMenu] = useState(false);
   const [showShareUrl, setShowShareUrl] = useState(true);
   const [showEmbedCode, setShowEmbedCode] = useState(false);
   const shareMenuRef = useRef<HTMLDivElement>(null);
   /**
      * Get the app URL based on the app's ID.
      * 
      * @returns {string} The app URL.
      */
   const getAppUrl = () => {
      return `/app/${hashId}`;
   };

   /**
   * Get the embed URL for the app.
   * 
   * @returns {string} The embed URL.
   */
   const getEmbedUrl = () => {
      const baseUrl = window.location.origin;
      return `${baseUrl}/app/embed/${hashId}`;
   };

   /**
   * Get the share URL for the app.
   * 
   * @returns {string} The share URL.
   */
   const getShareUrl = () => {
      const baseUrl = window.location.origin;
      const appUrl = getAppUrl();
      return `${baseUrl}${appUrl}`;
   };

   /**
       * Copy the share URL to the clipboard and hide the share menu.
       */
   const handleCopyLink = () => {
      navigator.clipboard.writeText(getShareUrl());
      setShowShareMenu(false);
      setShowModal(false);
   };

   /**
    * Method allows users to get code of iframe for integrating into their web sites
    */
   const handleCopyIframe = () => {
      const iframeCode = `<iframe src="${getEmbedUrl()}" width="600" height="400" frameBorder="0"></iframe>`;
      navigator.clipboard.writeText(iframeCode);
      setShowShareMenu(false);
      setShowModal(false);
   };

   /**
    * Method allows users to get direct URL of the app
    * 
    * @param {React.MouseEvent<HTMLButtonElement>} event - The event object.
    */
   const handleDirectUrlTab = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setShowShareUrl(true);
      setShowEmbedCode(false);
   };

   /**
    * Method allows users to get embed code of the app
    * 
    * @param {React.MouseEvent<HTMLButtonElement>} event - The event object.
    */
   const handleEmbedCodeTab = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setShowEmbedCode(true);
      setShowShareUrl(false);
   };

   /**
    * Method allows users to close the share menu and modal
    * 
    * @param {React.MouseEvent<HTMLButtonElement>} event - The event object.
    */
   const handleClose = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setShowShareMenu(false);
      setShowModal(false);
   };

   useEffect(() => {
      setShowShareMenu(showModal);
   }, [showModal]);

   // Effect to handle clicks outside the share menu and escape key
   useEffect(() => {
      /**
       * Method allows users to close the share menu when clicking outside the share menu
       * @param {MouseEvent} event - The event object.
       */
      const handleClickOutside = (event: MouseEvent) => {
         if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
            setShowShareMenu(false);
            setShowModal(false);
         }
      };

      /**
       * Method allows users to close the share menu when pressing the escape key
       * @param {KeyboardEvent} event - The event object.
       */
      const handleEscapeKey = (event: KeyboardEvent) => {
         if (event.key === 'Escape') {
            setShowShareMenu(false);
            setShowModal(false);
         }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);

      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
         document.removeEventListener('keydown', handleEscapeKey);
      };
   }, [setShowModal]);

   if (showShareMenu === false) {
      return null;
   }

   return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
         <div ref={shareMenuRef} className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            {/* Tab buttons */}
            <div className="flex space-x-4 mb-4 border-b">
               <button 
                  onClick={handleDirectUrlTab} 
                  disabled={showShareUrl}
                  className={`pb-2 px-4 ${showShareUrl 
                     ? 'text-blue-600 border-b-2 border-blue-600' 
                     : 'text-gray-500 hover:text-gray-700'}`}
               >
                  Direct URL
               </button>
               <button 
                  onClick={handleEmbedCodeTab} 
                  disabled={showEmbedCode}
                  className={`pb-2 px-4 ${showEmbedCode 
                     ? 'text-blue-600 border-b-2 border-blue-600' 
                     : 'text-gray-500 hover:text-gray-700'}`}
               >
                  Embed Code
               </button>
            </div>

            {/* Direct URL input */}
            {showShareUrl && (
               <div className="flex items-center space-x-2 mb-4">
                  <input
                     type="text"
                     value={getShareUrl()}
                     readOnly
                     className="flex-1 p-2 border rounded-lg bg-gray-50"
                  />
                  <button 
                     onClick={handleCopyLink}
                     className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                  >
                     <Copy size={16} />
                  </button>
               </div>
            )}

            {/* Embed code textarea */}
            {showEmbedCode && (
               <div className="space-y-2 mb-4">
                  <div className="relative">
                     <textarea
                        readOnly
                        value={`<iframe src="${getEmbedUrl()}" width="600" height="400" frameBorder="0"></iframe>`}
                        rows={3}
                        className="w-full p-2 border rounded-lg bg-gray-50 font-mono text-sm"
                     />
                  </div>
                  <button 
                     onClick={handleCopyIframe}
                     className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                  >
                     <Copy size={16} />
                  </button>
               </div>
            )}

            {/* Close button */}
            <button 
               onClick={handleClose}
               className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
               <X size={16} />
            </button>
         </div>
      </div>
   );
};

export default ShareModal;