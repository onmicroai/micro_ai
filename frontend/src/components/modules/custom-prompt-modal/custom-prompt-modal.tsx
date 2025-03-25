// \microai-frontend\components\modules\custom-prompt-modal\custom-prompt-modal.tsx
"use client";

import React, { useEffect, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: (e: any) => void;
  children?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  const [isModalOpen, setIsModalOpen] = useState(isOpen);

  useEffect(() => {
    setIsModalOpen(isOpen);
  }, [isOpen]);

  const closeModal = (e: any) => {
    if (e.target.classList.contains('modal-overlay')) {
      setIsModalOpen(false);
      onClose(e);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center modal-overlay" 
          onClick={closeModal}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative">
            <div className="mb-4">
              {children}
            </div>
            <button 
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Modal;
