// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Invalid token')

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Super Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, payload } = await req.json()
    let result

    switch (action) {
      case 'listUsers': {
        const { page = 1, perPage = 50 } = payload
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page: page,
          perPage: perPage,
        })
        if (error) throw error
        
        // Enrich with ban info from public.banned_users
        // We get the active bans
        const { data: bans } = await supabaseAdmin
          .from('banned_users')
          .select('*')
          .is('unbanned_at', null);

        // Map bans to users
        const usersWithBans = data.users.map(u => {
          const ban = bans?.find(b => b.user_id === u.id || b.email === u.email);
          return {
            ...u,
            ban_details: ban || null
          }
        });

        result = { ...data, users: usersWithBans }
        break
      }
      
      case 'createUser': {
        const { email, password, emailConfirm, userMetadata } = payload
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: emailConfirm,
          user_metadata: userMetadata
        })
        if (error) throw error
        result = data
        break
      }

      case 'updateUser': {
        const { userId, attributes } = payload
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          attributes
        )
        if (error) throw error
        result = data
        break
      }

      case 'banUser': {
        const { userId, email, reason, duration } = payload;
        
        // 1. Ban in Auth
        // duration in string format like '100y' or ISO timestamp? updateUserById takes `ban_duration` string
        // If permanent, use a very long duration.
        const banDuration = duration || '876000h'; // ~100 years default
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { ban_duration: banDuration }
        );
        if (authError) throw authError;

        // 2. Record in public.banned_users
        const { error: dbError } = await supabaseAdmin
          .from('banned_users')
          .insert({
            user_id: userId,
            email: email || authData.user.email,
            reason: reason,
            banned_by: user.id,
            banned_at: new Date().toISOString()
          });
          
        if (dbError) throw dbError;
        
        result = { success: true, user: authData.user };
        break;
      }

      case 'unbanUser': {
        const { userId, email, reason } = payload;

        // 1. Unban in Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { ban_duration: '0' } // Clear ban
        );
        if (authError) throw authError;

        // 2. Update public.banned_users
        // Find currently active ban for this user and close it
        const { error: dbError } = await supabaseAdmin
          .from('banned_users')
          .update({
            unbanned_at: new Date().toISOString(),
            unbanned_by: user.id,
            unbanned_reason: reason
          })
          .eq('user_id', userId)
          .is('unbanned_at', null);

        if (dbError) throw dbError;

        result = { success: true, user: authData.user };
        break;
      }

      case 'deleteUser': {
        // "Soft Delete" logic
        const { userId } = payload;

        // 1. Mark profile as deleted
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: user.id,
            is_active: false
          })
          .eq('id', userId);

        if (profileError) throw profileError;

        // 2. Ban user in Auth to prevent login
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { ban_duration: '876000h' } // 100 years
        );

        if (authError) throw authError;

        result = { success: true, message: "User soft deleted and banned" };
        break;
      }
      
      case 'logoutUser': {
        const { userId } = payload
        const { error } = await supabaseAdmin.auth.admin.signOut(userId)
        if (error) throw error
        result = { success: true }
        break
      }

      case 'unlinkIdentity': {
        const { userId, identityId } = payload
        const { data, error } = await supabaseAdmin.auth.admin.deleteUserIdentity(identityId)
        if (error) throw error
        result = { success: true, data }
        break
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})