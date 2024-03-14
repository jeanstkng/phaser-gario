import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const getRealtimeChannel = () => {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 100,
      },
    },
  });

  return {
    room: client.channel("room", {
      config: {
        broadcast: { self: false },
      },
    }),
    client,
  };
};
