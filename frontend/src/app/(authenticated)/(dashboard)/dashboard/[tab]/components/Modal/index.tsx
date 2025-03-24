import React, { useEffect, useRef, useState } from 'react';
import { FaX as X } from 'react-icons/fa6';
interface ModalProps {
   isOpen: boolean;
   onClose: () => void;
   onConfirm: () => void;
   title: string;
   message: string;
   confirmText?: string;
   cancelText?: string;
}

const Modal: React.FC<ModalProps> = ({
   isOpen,
   onClose,
   onConfirm,
   title,
   message,
   confirmText = 'Confirm',
   cancelText = 'Cancel'
}) => {
   const modalRef = useRef<HTMLDivElement>(null);
   const [showModal, setShowModal] = useState(isOpen);

   /**
    * Method allows users to close the modal
    */
   const handleClose = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setShowModal(false);
      onClose();
   };

   // Effect to handle clicks outside the share menu and escape key
   useEffect(() => {
      /**
       * Method allows users to close the modal when clicking outside the modal
       * @param {MouseEvent} event - The event object.
       */
      const handleClickOutside = (event: MouseEvent) => {
         if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
            setShowModal(false);
            onClose();
         }
      };

      /**
       * Method allows users to close the modal when pressing the escape key
       * @param {KeyboardEvent} event - The event object.
       */
      const handleEscapeKey = (event: KeyboardEvent) => {
         if (event.key === 'Escape') {
            setShowModal(false);
            onClose();
         }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);

      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
         document.removeEventListener('keydown', handleEscapeKey);
      };
   }, [onClose]);

   if (!isOpen) {
      return null;
   }

   if (showModal === false) {
      return null;
   }

   return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
         <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <h2 className="text-xl font-semibold mb-4">{title}</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            
            <div className="flex justify-end space-x-3">
               <button 
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
               >
                  {cancelText}
               </button>
               <button 
                  onClick={onConfirm}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
               >
                  {confirmText}
               </button>
            </div>

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

export default Modal;