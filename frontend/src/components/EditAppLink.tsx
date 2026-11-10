"use client";

import Link from "next/link";
import { FaEdit } from "react-icons/fa";

interface EditAppLinkProps {
  hashId: string;
}

const EditAppLink = ({ hashId }: EditAppLinkProps) => {
  return (
    <Link
      href={`/app/edit/${hashId}`}
      className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
    >
      <FaEdit size={14} />
      Edit
      <span className="sr-only"> this app</span>
    </Link>
  );
};

export default EditAppLink;
