"use client";
import PrivateNavbar from "@/components/layout/navbar/privateNavbar";
import { ToastContainer } from 'react-toastify';

export default function EditLayout({
  children,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <>
      <ToastContainer 
        stacked
        position="bottom-left"
        hideProgressBar={true}
      />
      <PrivateNavbar />
      {children}
    </>
  );
}