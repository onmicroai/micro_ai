import React from 'react';

interface TableWrapperProps {
  node?: any;
  [key: string]: any;
}

export default function TableWrapper({ node, ...props }: TableWrapperProps) {
  return (
    <div className="overflow-x-auto my-4">
      <table 
        className="min-w-full border-collapse border border-gray-300 bg-white text-sm"
        {...props} 
      />
    </div>
  );
}
