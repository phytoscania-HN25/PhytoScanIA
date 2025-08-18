// supabase/functions/admin-create-user/index.ts
// Crea usuarios desde la UI solo si el solicitante es ADMIN. No expone service key en el front.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Verificar JWT del usuario que llama (Authorization: Bearer <token>)
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response("Unauthorized", { status: 401 });

    const client = createClient(supabaseUrl, token);
    const { data: me, error: meErr } = await client
      .from("Usuarios")
      .select("rol, auth_user_id")
      .eq("auth_user_id", (await client.auth.getUser()).data.user?.id || "")
      .maybeSingle();
    if (meErr) throw meErr;
    if (!me || (me.rol || "").toLowerCase() !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }

    const body = await req.json();
    const { email, password, nombre_completo, rol } = body || {};
    if (!email || !password || !rol) {
      return new Response("Missing fields", { status: 400 });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre_completo: nombre_completo || "", rol: rol || "productor" },
    });
    if (error) return new Response(error.message, { status: 400 });

    return new Response(JSON.stringify({ id: data.user?.id }), { status: 200 });
  } catch (e) {
    return new Response((e as Error).message ?? "Error", { status: 500 });
  }
});
