import React, { useState, useEffect, useRef } from 'react';
import { FaX as X, FaCopy as Copy, FaFloppyDisk, FaCheck } from 'react-icons/fa6';
import { ShareModalProps } from '@/app/(authenticated)/(dashboard)/types';
import axiosInstance from '@/utils/axiosInstance';
/**
 * AppItem component renders an individual app with actions such as sharing and cloning.
 * 
 * @param {ShareModalProps} props - The properties for the AppItem component.
 * @returns {JSX.Element} The rendered AppItem component.
 */
interface LTIConfig {
   id?: number;
   microapp_id: number;
   issuer: string;
   client_id: string;
   auth_login_url: string;
   auth_token_url: string;
   key_set_url: string;
   deployment_ids: string[];
}

const ShareModal: React.FC<ShareModalProps> = ({ app, showModal, setShowModal }) => {
   const hashId = app.hashId;
   const [showShareMenu, setShowShareMenu] = useState(false);
   const [showShareUrl, setShowShareUrl] = useState(true);
   const [showEmbedCode, setShowEmbedCode] = useState(false);
   const [showLtiConfig, setShowLtiConfig] = useState(false);
   const [hasExistingConfig, setHasExistingConfig] = useState(false);
   const [ltiConfig, setLtiConfig] = useState<LTIConfig>({
      microapp_id: app.id,
      issuer: '',
      client_id: '',
      auth_login_url: '',
      auth_token_url: '',
      key_set_url: '',
      deployment_ids: []
   });
   const shareMenuRef = useRef<HTMLDivElement>(null);
   const [hasChanges, setHasChanges] = useState(false);
   const [isSaving, setIsSaving] = useState(false);
   const initialConfigRef = useRef<LTIConfig | null>(null);
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
      setShowLtiConfig(false);
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
      setShowLtiConfig(false);
   };

   /**
    * Method allows users to get LTI configuration of the app
    * 
    * @param {React.MouseEvent<HTMLButtonElement>} event - The event object.
    */
   const handleLtiConfigTab = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setShowLtiConfig(true);
      setShowShareUrl(false);
      setShowEmbedCode(false);
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

   // Add this function to check for changes
   const checkForChanges = (currentConfig: LTIConfig) => {
      if (!initialConfigRef.current) return false;
      return JSON.stringify(currentConfig) !== JSON.stringify(initialConfigRef.current);
   };

   // Update the handleLtiConfigChange function
   const handleLtiConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const newConfig = {
         ...ltiConfig,
         [name]: value
      };
      setLtiConfig(newConfig);
      setHasChanges(checkForChanges(newConfig));
   };

   // Update the handleLtiConfigSubmit function
   const handleLtiConfigSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
         const api = axiosInstance();
         const response = await api.post('/lti/api/config/', {
            ...ltiConfig,
            microapp_id: app.id,
            id: hasExistingConfig ? ltiConfig.id : undefined
         });
         
         if (response.status === 200) {
            setLtiConfig(response.data);
            setHasExistingConfig(true);
            setHasChanges(false);
            initialConfigRef.current = response.data;
         }
      } catch (error) {
         console.error('Error saving LTI config:', error);
      } finally {
         setIsSaving(false);
      }
   };

   // Update the fetch effect to store initial config
   useEffect(() => {
      if (showLtiConfig) {
         const fetchLtiConfig = async () => {
            try {
               const api = axiosInstance();
               const response = await api.get(`/lti/api/config/${app.id}/`);
               if (response.status === 200) {
                  setLtiConfig(response.data);
                  setHasExistingConfig(true);
                  initialConfigRef.current = response.data;
                  setHasChanges(false);
               }
            } catch (error: any) {
               if (error.response?.status === 404) {
                  // No configuration exists yet
                  setHasExistingConfig(false);
                  const emptyConfig = {
                     microapp_id: app.id,
                     issuer: '',
                     client_id: '',
                     auth_login_url: '',
                     auth_token_url: '',
                     key_set_url: '',
                     deployment_ids: []
                  };
                  setLtiConfig(emptyConfig);
                  initialConfigRef.current = emptyConfig;
                  setHasChanges(false);
               } else {
                  console.error('Error fetching LTI config:', error);
               }
            }
         };
         fetchLtiConfig();
      }
   }, [showLtiConfig, app.id]);

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
         <div ref={shareMenuRef} className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col relative">
            {/* Header with close button */}
            <div className="p-6 pb-0 flex justify-between items-center">
               <div className="flex space-x-4 border-b w-full">
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
                  <button 
                     onClick={handleLtiConfigTab} 
                     disabled={showLtiConfig}
                     className={`pb-2 px-4 ${showLtiConfig 
                        ? 'text-blue-600 border-b-2 border-blue-600' 
                        : 'text-gray-500 hover:text-gray-700'}`}
                  >
                     LTI
                  </button>
               </div>
               <button 
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
               >
                  <X size={16} />
               </button>
            </div>

            {/* Scrollable content */}
            <div className="p-6 overflow-y-auto">
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

               {/* LTI Configuration section */}
               {showLtiConfig && (
                  <div className="space-y-4">
                     <div className="bg-gray-50 p-4 rounded-lg">
                        {/* Step 1: LTI Tool Configuration */}
                        <div className="mb-6">
                           <h4 className="font-semibold text-gray-900 mb-3">Step 1: Configure your LMS</h4>
                           <p className="text-gray-600 mb-4">Add these values in your LMS to configure OnMicro.AI as an LTI provider. Your LMS should then generated credentials for you that you'll use in Step 2.</p>
                           <div className="space-y-3">
                              <div>
                                 <label className="block text-sm font-medium text-gray-700">LTI Version</label>
                                 <input
                                    type="text"
                                    value="1.3"
                                    readOnly
                                    className="mt-1 w-full p-2 border rounded-lg bg-white"
                                 />
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-700">Tool Launch URL</label>
                                 <div className="flex items-center space-x-2">
                                    <input
                                       type="text"
                                       value={`${window.location.origin}/lti/launch/`}
                                       readOnly
                                       className="mt-1 w-full p-2 border rounded-lg bg-white"
                                    />
                                    <button
                                       onClick={() => navigator.clipboard.writeText(`${window.location.origin}/lti/launch/`)}
                                       className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                                    >
                                       <Copy size={16} />
                                    </button>
                                 </div>
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-700">Tool Initiate URL</label>
                                 <div className="flex items-center space-x-2">
                                    <input
                                       type="text"
                                       value={`${window.location.origin}/lti/login/`}
                                       readOnly
                                       className="mt-1 w-full p-2 border rounded-lg bg-white"
                                    />
                                    <button
                                       onClick={() => navigator.clipboard.writeText(`${window.location.origin}/lti/login/`)}
                                       className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                                    >
                                       <Copy size={16} />
                                    </button>
                                 </div>
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-700">JWKs URL</label>
                                 <div className="flex items-center space-x-2">
                                    <input
                                       type="text"
                                       value={`${window.location.origin}/lti/jwks/`}
                                       readOnly
                                       className="mt-1 w-full p-2 border rounded-lg bg-white"
                                    />
                                    <button
                                       onClick={() => navigator.clipboard.writeText(`${window.location.origin}/lti/jwks/`)}
                                       className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                                    >
                                       <Copy size={16} />
                                    </button>
                                 </div>
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-700">Deep Linking</label>
                                 <input
                                    type="text"
                                    value="False"
                                    readOnly
                                    className="mt-1 w-full p-2 border rounded-lg bg-white"
                                 />
                              </div>
                           </div>
                        </div>

                        {/* Step 2: LTI Configuration */}
                        <div className="mb-4">
                           
                              <h3 className="font-semibold">Step 2: Configure your LMS credentials</h3>
                              <p className="text-gray-600 mb-4">Save the values generated by your LMS from Step 1.</p>
                           

                           <form onSubmit={handleLtiConfigSubmit} className="space-y-4">
                              <div>
                                 <label className="block text-sm font-medium text-gray-700">Issuer</label>
                                 <input
                                    type="text"
                                    name="issuer"
                                    value={ltiConfig.issuer}
                                    onChange={handleLtiConfigChange}
                                    className="mt-1 w-full p-2 border rounded-lg bg-white"
                                    required
                                 />
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-700">Client ID</label>
                                 <input
                                    type="text"
                                    name="client_id"
                                    value={ltiConfig.client_id}
                                    onChange={handleLtiConfigChange}
                                    className="mt-1 w-full p-2 border rounded-lg bg-white"
                                    required
                                 />
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-700">Auth Login URL</label>
                                 <input
                                    type="text"
                                    name="auth_login_url"
                                    value={ltiConfig.auth_login_url}
                                    onChange={handleLtiConfigChange}
                                    className="mt-1 w-full p-2 border rounded-lg bg-white"
                                    required
                                 />
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-700">Auth Token URL</label>
                                 <input
                                    type="text"
                                    name="auth_token_url"
                                    value={ltiConfig.auth_token_url}
                                    onChange={handleLtiConfigChange}
                                    className="mt-1 w-full p-2 border rounded-lg bg-white"
                                    required
                                 />
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-700">Keyset URL</label>
                                 <input
                                    type="text"
                                    name="key_set_url"
                                    value={ltiConfig.key_set_url}
                                    onChange={handleLtiConfigChange}
                                    className="mt-1 w-full p-2 border rounded-lg bg-white"
                                    required
                                 />
                              </div>
                              <button
                                 type="submit"
                                 disabled={!hasChanges || isSaving}
                                 className={`w-full py-2 px-4 rounded-lg transition-colors ${
                                    hasChanges 
                                       ? 'bg-primary text-primary-foreground hover:bg-primary-600' 
                                       : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                 }`}
                              >
                                 {hasChanges ? (
                                    <>
                                       <FaFloppyDisk className="inline mr-2" />
                                       Save Configuration
                                    </>
                                 ) : (
                                    <>
                                       <FaCheck className="inline mr-2" />
                                       Saved
                                    </>
                                 )}
                              </button>
                           </form>
                        </div>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
   );
};

export default ShareModal;