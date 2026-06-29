import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type CustomerSessionResult =
  | {
      error: string;
      status: number;
      supabase: null;
      user: null;
    }
  | {
      error: null;
      status: 200;
      supabase: SupabaseClient;
      user: {
        id: string;
        email: string;
        role: string | null;
      };
    };

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function resolveCustomerSession(request: Request): Promise<CustomerSessionResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      error: "Supabase service role is not configured.",
      status: 503,
      supabase: null,
      user: null,
    };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return {
      error: "A valid SwingFi login session is required.",
      status: 401,
      supabase: null,
      user: null,
    };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const authUser = authData.user;
  const email = normalizeEmail(authUser?.email);

  if (authError || !authUser || !email) {
    return {
      error: "Your login session could not be verified.",
      status: 401,
      supabase: null,
      user: null,
    };
  }

  const initialUserResult = await supabase
    .from("users")
    .select("id,email,role,auth_user_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  let userRow = initialUserResult.data as Record<string, unknown> | null;
  let userError = initialUserResult.error;

  if (!userRow && !userError) {
    const byEmail = await supabase
      .from("users")
      .select("id,email,role,auth_user_id")
      .eq("email", email)
      .maybeSingle();

    userRow = byEmail.data as Record<string, unknown> | null;
    userError = byEmail.error;
  }

  if (userError) {
    return {
      error: userError.message,
      status: 503,
      supabase: null,
      user: null,
    };
  }

  if (!userRow) {
    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert({
        auth_user_id: authUser.id,
        email,
        full_name:
          typeof authUser.user_metadata?.full_name === "string"
            ? authUser.user_metadata.full_name
            : email,
        role: "customer",
      })
      .select("id,email,role")
      .single();

    if (insertError || !inserted) {
      return {
        error: insertError?.message ?? "Could not create your SwingFi customer record.",
        status: 503,
        supabase: null,
        user: null,
      };
    }

    userRow = inserted as Record<string, unknown>;
  }

  if (!userRow) {
    return {
      error: "Could not resolve your SwingFi customer record.",
      status: 503,
      supabase: null,
      user: null,
    };
  }

  return {
    error: null,
    status: 200,
    supabase,
    user: {
      id: String(userRow.id),
      email: normalizeEmail(userRow.email),
      role: typeof userRow.role === "string" ? userRow.role : null,
    },
  };
}
