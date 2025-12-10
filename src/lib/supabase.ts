// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 简单的检查，防止 Key 没填导致报错
if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase 环境变量缺失！请检查 .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseKey);