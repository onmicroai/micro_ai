"use client";
import React, { useState } from "react";

interface DropdownProps {
  title: string;
  items: string[];
  type?: string;
}

const Dropdown = ({ title, items, type }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative inline-block ${
      type === "DASHBOARD" ? "w-full" : ""
    }`}>
      <button 
        onClick={toggleDropdown}
        className={`${
          type === "DASHBOARD" 
            ? "w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
            : "px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
        }`}
      >
        {title}
      </button>

      <div className={`${
        isOpen ? "block" : "hidden"
      } ${
        type === "DASHBOARD"
          ? "w-full"
          : "absolute mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5"
      }`}>
        <ul className="py-1">
          {items.map((item, index) => (
            <li 
              key={index}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Dropdown;
