import { createClient } from "@supabase/supabase-js";

export const getRealtimeChannel = () => {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 200,
      },
    },
  });

  return client.channel("room-1", {
    config: {
      broadcast: { self: false },
    },
  });
};
