import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

Deno.serve(async (_req: Request) => {
  try {
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default.
      Deno.env.get("SUPABASE_URL") ?? "",
      // Supabase API ANON KEY - env var exported by default.
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data, error } = await supabaseClient.from("cells").select("*");

    if (error) {
      throw error;
    }

    async function generateNewCells() {
      for (let idx = 0; idx < 100; idx++) {
        await supabaseClient.from("cells").insert({
          x: Math.random() * (4100 - 100) + 100,
          y: Math.random() * (4100 - 100) + 100,
          isEaten: false,
        });
      }
    }

    if (data.length <= 0) {
      await generateNewCells();
    } else {
      for (const cell of data) {
        if (cell.isEaten) {
          await supabaseClient
            .from("cells")
            .update({
              x: Math.random() * (4100 - 100) + 100,
              y: Math.random() * (4100 - 100) + 100,
              isEaten: false,
            })
            .eq("id", cell.id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
