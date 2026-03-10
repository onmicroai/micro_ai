"use client";

import AppRuntimeView from "@/components/AppRuntimeView";

type PageParams = {
   params: {
      id: string;  // Next.js route parameters are strings
   };
};

export default function SurveyDisplay({ params }: PageParams) {
   const hashId = params.id?.toString() || "";
   return <AppRuntimeView hashId={hashId} />;
}
