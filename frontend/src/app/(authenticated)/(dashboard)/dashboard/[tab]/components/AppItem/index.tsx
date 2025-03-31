import React, { useState, useRef } from 'react';
import { FaTrashCan as TrashCan, FaRegCopy, FaShareNodes, FaPenToSquare, FaChartLine, FaEllipsisVertical } from 'react-icons/fa6';
import Link from "next/link";
import { AppItemProps } from '@/app/(authenticated)/(dashboard)/types';
import Modal from '../Modal';
import axiosInstance from "@/utils//axiosInstance";
import { toast } from 'react-toastify';
import ShareModal from '../ShareModal';
   
/**
 * AppItem component renders an individual app with actions such as sharing and cloning.
 * 
 * @param {AppItemProps} props - The properties for the AppItem component.
 * @returns {JSX.Element} The rendered AppItem component.
 */
const AppItem: React.FC<AppItemProps> = ({ app, collectionId, onCloneApp, onDeleteApp }) => {
   const appId = app.id;
   const hashId = app.hashId;
   const [showShareMenu, setShowShareMenu] = useState(false);
   const [showDeleteModal, setShowDeleteModal] = useState(false);
   const [showDropdown, setShowDropdown] = useState(false);
   const dropdownRef = useRef<HTMLDivElement | null>(null);
   const api = axiosInstance();

   // Add click outside handler to close dropdown
   React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setShowDropdown(false);
         }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   /**
    * Handle the click event to clone the app.
    * 
    * @param {React.MouseEvent<HTMLButtonElement>} event - The click event.
    */
   const handleCloneClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (app.copyAllowed) {
         onCloneApp(appId, collectionId);
      }
   };

   /**
    * Get the app URL based on the app's ID.
    * 
    * @returns {string} The app URL.
    */
   const getAppUrl = () => {
      return `/app/${hashId}`;
   };

   /**
    * Get the appropriate privacy title for based on app's type.
    * 
    * @returns {string} The CSS class for the app's privacy title.
    */
   const getPrivacyName = () => {
      if (app?.privacy === undefined) {
         return "Private";
      }

      switch (app.privacy.toLowerCase()) {
         case "public":
            return "Public";
         case "private":
            return "Private";
         case "restricted":
            return "Restricted";
         default:
            return "Private";
      }
   };

   /**
    * Handle the click event to show the delete confirmation modal.
    */
   const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setShowDeleteModal(true);
   };

   /**
    * Handle the confirmation to delete the app.
    */
   const handleConfirmDelete = async () => {
      try {
         const response = await api.delete(`/api/microapps/${app.id}/archive`);

         if (response.status === 200) {
            toast.success("App deleted successfully.", { theme: "colored" });
            onDeleteApp(app.id); // Call the callback function to update the parent state
         } else {
            toast.error("Failed to delete the app.", { theme: "colored" });
         }
      } catch {
         toast.error("Error deleting the app.", { theme: "colored" });
      }
      setShowDeleteModal(false);
   };

   return (
      <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-gray-50 space-y-2 sm:space-y-0">
         {/* Title Column */}
         <div className="flex-1 min-w-0 pr-4">
            <Link 
               href={getAppUrl()} 
               className="text-gray-900 hover:text-blue-600 font-medium truncate block"
            >
               {app.title}
            </Link>
         </div>

         {/* Privacy Status Column */}
         <div className="w-24 md:w-48">
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full
               ${getPrivacyName().toLowerCase() === 'public' ? 'bg-green-100 text-green-800' : ''}
               ${getPrivacyName().toLowerCase() === 'private' ? 'bg-gray-100 text-gray-800' : ''}
               ${getPrivacyName().toLowerCase() === 'restricted' ? 'bg-yellow-100 text-yellow-800' : ''}
            `}>
               {getPrivacyName()}
            </span>
         </div>

         {/* Actions Column */}
         <div className="w-24 md:w-64">
            <div className="flex items-center space-x-1 md:space-x-2">
               <Link 
                  href={`/app/edit/${hashId}`}
                  className="flex items-center space-x-1 text-sm text-gray-600 hover:text-blue-600">
                  <span>Edit</span>
                  <FaPenToSquare className="w-4 h-4" />
               </Link>

               {/* Dropdown Menu */}
               <div className="relative" ref={dropdownRef}>
                  <button
                     onClick={() => setShowDropdown(!showDropdown)}
                     className="flex items-center space-x-1 text-sm text-gray-600 hover:text-blue-600 p-1"
                  >
                     <FaEllipsisVertical className="w-4 h-4" />
                  </button>

                  {showDropdown && (
                     <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                        <div className="py-1">
                           <Link 
                              href={`/app/${hashId}/stats`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={() => setShowDropdown(false)}
                           >
                              <FaChartLine className="w-4 h-4 mr-2" />
                              Stats
                           </Link>

                           <button
                              onClick={(e) => {
                                 e.preventDefault();
                                 setShowDropdown(false);
                                 setShowShareMenu(true);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                           >
                              <FaShareNodes className="w-4 h-4 mr-2" />
                              Share
                           </button>

                           <button
                              onClick={(e) => {
                                 e.preventDefault();
                                 setShowDropdown(false);
                                 handleCloneClick(e);
                              }}
                              disabled={!app.copyAllowed}
                              className={`flex items-center w-full px-4 py-2 text-sm ${
                                 app.copyAllowed 
                                    ? 'text-gray-700 hover:bg-gray-100' 
                                    : 'text-gray-400 cursor-not-allowed'
                              }`}
                           >
                              <FaRegCopy className="w-4 h-4 mr-2" />
                              Clone
                           </button>

                           <button
                              onClick={(e) => {
                                 e.preventDefault();
                                 setShowDropdown(false);
                                 handleDeleteClick(e);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                           >
                              <TrashCan className="w-4 h-4 mr-2" />
                              Delete
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            </div>
         </div>

         <ShareModal 
            app={app} 
            showModal={showShareMenu} 
            setShowModal={setShowShareMenu} 
         />

         {showDeleteModal && (
            <Modal
               isOpen={showDeleteModal}
               onClose={() => setShowDeleteModal(false)}
               onConfirm={handleConfirmDelete}
               title="Delete Application"
               message="Are you sure you want to delete this application?"
            />
         )}
      </div>
   );
};

export default AppItem;