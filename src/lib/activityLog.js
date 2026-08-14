import { supabase } from './supabaseClient'

export async function logActivity(businessId, userId, action, details = null) {
  try {
    await supabase.from('activity_logs').insert({
      business_id: businessId,
      user_id: userId,
      action,
      details,
    })
  } catch (err) {
    // Logging failures should never block the actual action
    console.error('Failed to log activity:', err)
  }
}
