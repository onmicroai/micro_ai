import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { FaX as X } from "react-icons/fa6";

/** Optional container for dropdowns/portals inside the modal. When set, portaled content renders inside the modal DOM so click-outside works correctly. */
export const ModalPortalContext = createContext<HTMLElement | null>(null);

export function useModalPortalContainer(): HTMLElement | null {
  return useContext(ModalPortalContext);
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Simple message for confirm dialogs. Omit when using children. */
  message?: string;
  /** Called when Confirm is clicked. Omit when using children with custom footer. */
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  /** Primary variant for confirm button: danger (red) or default (primary). */
  confirmVariant?: "danger" | "default";
  /** Custom content. When provided, replaces message and default footer. */
  children?: React.ReactNode;
  /** When true (or when returns true), outside clicks do not close the modal. Use when a dropdown is open. */
  preventCloseOnOutsideClick?: boolean | (() => boolean);
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  children,
  preventCloseOnOutsideClick = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null
  );
  const portalContainerRef = useCallback((node: HTMLDivElement | null) => {
    setPortalContainer(node);
  }, []);
  const [showModal, setShowModal] = useState(isOpen);
  const useCustomContent = children != null;

  useEffect(() => {
    setShowModal(isOpen);
  }, [isOpen]);

  const handleClose = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    setShowModal(false);
    onClose();
  };

  if (!isOpen || showModal === false) {
    return null;
  }

  const confirmButtonClasses =
    confirmVariant === "danger"
      ? "px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
      : "px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-600 transition-colors";

  const modalContent = (
    <ModalPortalContext.Provider value={portalContainer}>
      <div
        className="fixed inset-0 flex items-center justify-center z-[9999]"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const shouldPrevent =
            typeof preventCloseOnOutsideClick === "function"
              ? preventCloseOnOutsideClick()
              : preventCloseOnOutsideClick;
          if (shouldPrevent) return;
          handleClose();
        }}
      >
        <div
          ref={modalRef}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xl relative dark:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Portal container for Select dropdowns - keeps them inside modal DOM so click-outside works */}
          <div
            ref={portalContainerRef}
            className="absolute inset-0 pointer-events-none z-[10001]"
            aria-hidden
          />
          <h2 className="text-xl p-6 font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <div className="w-full border-b border-gray-200" />
          <div className="p-6">
            {useCustomContent ? (
              children
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {message}
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => handleClose()}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {cancelText}
                  </button>
                  <button onClick={onConfirm} className={confirmButtonClasses}>
                    {confirmText}
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => handleClose()}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </ModalPortalContext.Provider>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
};

export default Modal;
