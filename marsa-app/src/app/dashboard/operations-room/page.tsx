"use client";

import dynamic from "next/dynamic";

// Load the heavy operations-room client component lazily and DO NOT render
// it on the server. This eliminates every possible hydration mismatch
// (Date(), locale formatting, useSession bootstrap, etc.) by skipping the
// SSR pass for this route entirely.
const OperationsRoom = dynamic(() => import("./OperationsRoomClient"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <p className="text-muted-foreground">جاري التحميل...</p>
    </div>
  ),
});

export default function Page() {
  return <OperationsRoom />;
}
