"use client";

import { useState } from "react";
import { Copy, Check, User, Menu } from "lucide-react";
import { Button } from "./button";
import Image from "next/image";
import Logo from "@/img/logos/onMicroAI_logo_horiz_color-cropped.svg";

interface MonitorPreviewProps {
  children: React.ReactNode;
  previewUrl: string;
}

export default function MonitorPreview({
  children,
  previewUrl,
}: MonitorPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(previewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-[1000px] mx-auto pt-8 pb-24">
      {/* Monitor frame */}
      <div className="bg-gray-200 shadow-lg overflow-hidden shadow-sm rounded-xl">
        {/* Address bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-200 border-b border-gray-200">
          {/* Traffic lights */}
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>

          {/* URL bar */}
          <div
            className="cursor-pointer flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-sm px-3 py-1.5 ml-4"
            onClick={handleCopyUrl}   
         >
            <span className="text-sm text-primary-600 truncate flex-1">
              {previewUrl}
            </span>
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-primary-600" />
              )}
          </div>
        </div>

        <div className="bg-white border-b border-gray-200 h-16">
          <div className="flex items-center h-full px-5 max-w-[1400px] mx-auto">
            <Menu className="h-6 w-6 text-gray-500 mr-4" />
            <div className="flex items-center h-full cursor-default">
              <Image
                src={Logo}
                alt="Micro AI"
                width={175}
                height={56}
                className="w-[175px] h-[56px] object-contain"
                priority
              />
            </div>
            <div className="ml-auto flex items-center gap-6">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center cursor-default">
                <User className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-[600px]">{children}</div>
      </div>
    </div>
  );
}
