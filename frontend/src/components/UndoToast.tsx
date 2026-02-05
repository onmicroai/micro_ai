import React from "react";
import { toast } from "react-toastify";
import { Undo2 } from "lucide-react";

type UndoToastOptions = {
  message: string;
  onUndo: () => void;
  autoClose?: number;
};

export const showUndoToast = ({
  message,
  onUndo,
  autoClose = 5000,
}: UndoToastOptions) => {
  let didUndo = false;
  const toastId = toast.info(
    <div className="flex justify-between gap-3">
      <span className="text-sm text-gray-900">{message}</span>
      <button
        type="button"
        onClick={() => {
          if (didUndo) return;
          didUndo = true;
          toast.dismiss(toastId);
          onUndo();
        }}
        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-normal text-primary-600 hover:bg-gray-100"
      >
        <Undo2 className="h-4 w-4" />
        Undo
      </button>
    </div>,
    {
      autoClose,
      closeOnClick: false,
      closeButton: false,
      draggable: false,
      icon: false,
      position: "bottom-right",
    },
  );
  return toastId;
};
