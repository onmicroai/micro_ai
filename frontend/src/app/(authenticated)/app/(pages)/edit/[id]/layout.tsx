"use client";
import NavBarClientSwitch from "@/components/layout/navbar/NavBarClientSwitch";
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
      <NavBarClientSwitch />
      {children}
    </>
  );
}