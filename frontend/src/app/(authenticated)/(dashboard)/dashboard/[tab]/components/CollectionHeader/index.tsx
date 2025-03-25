import { useEffect, useRef, useState } from 'react';
import {FaPenToSquare, FaFilter } from 'react-icons/fa6';
import { Collection } from '@/app/(authenticated)/(dashboard)/types';
import Link from 'next/dist/client/link';

interface CollectionHeaderProps {
   activeCollection: Collection | null;
   collections: Collection[];
   updateCollectionName: (collectionId: number, newName: string) => Promise<void>;
   activeTab: string;
}

const CollectionHeader: React.FC<CollectionHeaderProps> = ({
   activeCollection,
   collections,
   updateCollectionName,
   activeTab,
}) => {
   const [isEditing, setIsEditing] = useState(false);
   const [editedName, setEditedName] = useState("");
   const [isDropdownOpen, setIsDropdownOpen] = useState(false);
   const dropdownMenuRef = useRef<HTMLDivElement>(null);
   /**
       * Handles the click event to start editing the collection name.
       */
   const handleEditClick = () => {
      setIsEditing(true);
   };

   /**
    * Handles changes to the collection name input field.
    * 
    * @param {React.ChangeEvent<HTMLInputElement>} event - The input change event
    */
   const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      event.preventDefault();
      const newName = event.target.value;
      setEditedName(newName);
   };

   /**
    * Handles the completion of editing the collection name.
    * If the name has changed, it updates the collection name on the server.
    * 
    * @param {React.ChangeEvent<HTMLInputElement>} event - The input change event
    * @returns {Promise<void>}
    */
   const handleNameBlur = async (event: React.ChangeEvent<HTMLInputElement>) => {
      event.preventDefault();
      if (editedName !== activeCollection?.name && activeCollection) {
         await updateCollectionName(activeCollection.id, editedName);
      }
      setIsEditing(false);
   };

   /**
    * Handles key presses in the collection name input field.
    * 
    * @param {React.KeyboardEvent<HTMLInputElement>} event - The keyboard event
    */
   const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
         event.preventDefault();
         event.currentTarget.blur();
         setIsEditing(false);
      } else if (event.key === 'Escape') {
         event.preventDefault();
         setEditedName(activeCollection?.name || "");
         setIsEditing(false);
      }
   };

    // Effect to handle clicks outside the share menu and escape key
    useEffect(() => {
      /**
       * Method allows users to close the share menu when clicking outside the share menu
       * @param {MouseEvent} event - The event object.
       */
      const handleClickOutside = (event: MouseEvent) => {
         if (dropdownMenuRef.current && !dropdownMenuRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
         }
      };

      /**
       * Method allows users to close the share menu when pressing the escape key
       * @param {KeyboardEvent} event - The event object.
       */
      const handleEscapeKey = (event: KeyboardEvent) => {
         if (event.key === 'Escape') {
            setIsDropdownOpen(false);
         }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);

      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
         document.removeEventListener('keydown', handleEscapeKey);
      };
   }, []);

   useEffect(() => {
      setEditedName(activeCollection?.name || "");
   }, [activeCollection]);

   return (
      <div className="mb-6">
         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-200 pb-4">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
               {/* Collection Dropdown */}
               <div className="relative">
                  <button 
                     onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                     className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded-md"
                  >
                     <FaFilter className="w-4 h-4" />
                  </button>
                  
                  {isDropdownOpen && (
                     <div 
                        ref={dropdownMenuRef}
                        className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10"
                     >
                        <div className="py-1">
                           {collections.map((col) => (
                              <Link
                                 key={col.id}
                                 href={`/dashboard/${activeTab}/${col.id}`}
                                 className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                 {col.name}
                              </Link>
                           ))}
                        </div>
                     </div>
                  )}
               </div>

               {/* Collection Name Edit */}
               <div className="flex items-center space-x-2">
                  {isEditing ? (
                     <input
                        type="text"
                        value={editedName}
                        onChange={handleNameChange}
                        onBlur={handleNameBlur}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     />
                  ) : (
                     <div className="flex items-center space-x-2 group cursor-pointer" onClick={handleEditClick}>
                        <span className="font-semibold text-gray-900">{activeCollection?.name}</span>
                        <FaPenToSquare className="w-4 h-4 opacity-0 group-hover:opacity-100" />
                     </div>
                  )}
               </div>
            </div>

            {/* Table Headers */}
            <div className="hidden sm:flex items-center space-x-4 md:space-x-8">
               <div className="w-24 md:w-48 text-sm font-semibold text-gray-600">Privacy</div>
               <div className="w-24 md:w-64 text-sm font-semibold text-gray-600">Actions</div>
            </div>
         </div>
      </div>
   );
};

export default CollectionHeader; 