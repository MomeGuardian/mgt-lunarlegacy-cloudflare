import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("🚨 Supabase 环境变量缺失！请检查 Cloudflare 设置。");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
