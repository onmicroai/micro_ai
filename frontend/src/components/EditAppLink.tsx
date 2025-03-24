"use client";

import Link from "next/link";
import { FaEdit } from "react-icons/fa";

interface EditAppLinkProps {
  hashId: string;
}

const EditAppLink = ({ hashId }: EditAppLinkProps) => {
  return (
    <div className="mb-0 flex justify-end">
      <Link
        href={`/app/edit/${hashId}`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800"
      >
        Edit this app
        <FaEdit size={15} className="ml-2" />
      </Link>
    </div>
  );
};

export default EditAppLink; 