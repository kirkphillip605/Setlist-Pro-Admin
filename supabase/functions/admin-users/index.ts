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
    // 1. Authenticate the user calling this function
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create a client with the user's token to check their permissions
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Invalid token')

    // 2. Check if the user is a super_admin in public.profiles
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

    // 3. Initialize Admin Client (Service Role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, payload } = await req.json()

    let result

    switch (action) {
      case 'listUsers': {
        const { page = 1, perPage = 50, query } = payload
        // Supabase Admin API doesn't support complex search in listUsers easily without getting all
        // So we get a batch.
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page: page,
          perPage: perPage,
        })
        if (error) throw error
        result = data
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
        
        // Also ensure profile exists (trigger might handle it, but we can double check)
        // Ideally we update the profile with specific data if needed
        result = data
        break
      }

      case 'updateUser': {
        const { userId, attributes } = payload
        // attributes can include email, password, user_metadata, etc.
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          attributes
        )
        if (error) throw error
        result = data
        break
      }

      case 'deleteUser': {
        const { userId } = payload
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (error) throw error
        result = { success: true, data }
        break
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