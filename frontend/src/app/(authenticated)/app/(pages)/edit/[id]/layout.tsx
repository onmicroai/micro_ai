"use client";
import { ToastContainer } from "react-toastify";

export default function EditLayout({
  children,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <>
      <ToastContainer stacked position="bottom-left" hideProgressBar={true} />
      {children}
    </>
  );
}
