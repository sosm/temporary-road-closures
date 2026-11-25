 "use client";

import { useRouter } from "next/navigation";

export default function BackToApplication() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/closures");
        }
      }}
      className="text-blue-700 underline"
    >
      Back to application
    </button>
  );
}
