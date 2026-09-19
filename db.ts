/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/**
 * Loosely typed handle on the CAMPUS demo tables. The generated database types
 * lag behind migrations, so queries in this prototype go through this alias.
 */
export const db = supabase as unknown as SupabaseClient<any, "public", any>;

/** A database row in this prototype. Intentionally loose. */
export type Row = any;
