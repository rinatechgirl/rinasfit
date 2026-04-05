// ─────────────────────────────────────────────────────────────────────────────
// Replace the QueryClient instantiation at the top of your App.tsx with this:
//
//   const queryClient = new QueryClient({
//     defaultOptions: {
//       queries: {
//         // Don't re-fetch on window focus — prevents the flash of loading
//         // state every time the user switches tabs back to the app
//         refetchOnWindowFocus: false,
//         // Keep data fresh for 2 minutes before considering it stale
//         staleTime: 2 * 60 * 1000,
//         // Retry failed requests only once
//         retry: 1,
//       },
//     },
//   });
//
// This single change stops React Query from hammering Supabase with
// re-fetches every time the user switches tabs, which was contributing
// to the loading flash alongside the auth token refresh.
// ─────────────────────────────────────────────────────────────────────────────

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
      retry: 1,
    },
  },
});
