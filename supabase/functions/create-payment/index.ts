// Supabase Edge Function pour créer un paiement Paygreen sécurisé
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYGREEN_API_URL = 'https://api.paygreen.fr/payment/payment-orders'
const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY') ?? ''
const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper pour parser le pickup time (format: "Aujourd'hui 14h30", "Demain 11h00", "Lundi 12h00")
function parsePickupTime(pickup: string): Date | null {
  if (!pickup || pickup === 'asap') return null

  const now = new Date()
  let targetDate = new Date(now)

  // Extraire l'heure (format: "14h30")
  const timeMatch = pickup.match(/(\d+)h(\d+)/)
  if (!timeMatch) return null

  const hours = parseInt(timeMatch[1])
  const minutes = parseInt(timeMatch[2])

  // Déterminer le jour
  if (pickup.includes('Aujourd\'hui') || pickup.includes("Aujourd'hui")) {
    targetDate.setHours(hours, minutes, 0, 0)
  } else if (pickup.includes('Demain')) {
    targetDate.setDate(targetDate.getDate() + 1)
    targetDate.setHours(hours, minutes, 0, 0)
  } else {
    // Jour de la semaine (Lundi, Mardi, etc.)
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    const jourIndex = jours.findIndex(j => pickup.includes(j))
    if (jourIndex === -1) return null

    // Trouver le prochain jour correspondant
    const currentDay = now.getDay()
    let daysToAdd = jourIndex - currentDay
    if (daysToAdd <= 0) daysToAdd += 7 // Si déjà passé cette semaine, aller à la semaine prochaine

    targetDate.setDate(targetDate.getDate() + daysToAdd)
    targetDate.setHours(hours, minutes, 0, 0)
  }

  return targetDate
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderNum, total, email, name, phone, pickup, note, items } = await req.json()

    // Validation params
    if (!orderNum || !total || !email || !name) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Init Supabase client (on en aura besoin pour les validations)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ===== VALIDATION #1 : PAUSE ADMIN =====
    const { data: pauseData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'next_slot_available_at')
      .maybeSingle()

    if (pauseData?.value) {
      const pauseDate = new Date(pauseData.value)
      const now = new Date()

      // Si pause active et pickup = "asap", refuser
      if (pickup === 'asap' && pauseDate > now) {
        return new Response(
          JSON.stringify({ error: 'Restaurant en pause. Actualisez la page et choisissez un autre créneau.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Si pickup est un créneau spécifique, valider qu'il est après la pause
      if (pickup !== 'asap') {
        // Parser "Aujourd'hui 14h30", "Demain 11h00", etc.
        const pickupDate = parsePickupTime(pickup)
        if (pickupDate && pickupDate < pauseDate) {
          return new Response(
            JSON.stringify({ error: 'Ce créneau n\'est plus disponible. Actualisez la page.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // ===== VALIDATION #2 : MENU DISPONIBLE =====
    if (items && items.length > 0) {
      const itemIds = items.map((i: any) => i.id)
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('id, disponible, nom')
        .in('id', itemIds)

      // Vérifier que tous les items existent
      if (!menuData || menuData.length !== itemIds.length) {
        return new Response(
          JSON.stringify({ error: 'Certains plats ne sont plus au menu. Actualisez la page.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Vérifier que tous les items sont disponibles
      const unavailableItems = menuData.filter(i => !i.disponible)
      if (unavailableItems.length > 0) {
        return new Response(
          JSON.stringify({
            error: `Le plat "${unavailableItems[0].nom}" n'est plus disponible. Actualisez la page.`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Étape 1 : Obtenir un JWT token depuis l'Auth API
    const authResponse = await fetch(`https://api.paygreen.fr/auth/authentication/${PAYGREEN_SHOP_ID}/secret-key`, {
      method: 'POST',
      headers: {
        'Authorization': PAYGREEN_SECRET_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('Erreur Auth Paygreen:', authResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: `Auth Paygreen (${authResponse.status}): ${errorText}` }),
        { status: authResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authData = await authResponse.json()
    const jwtToken = authData.data?.token || authData.token

    if (!jwtToken) {
      console.error('JWT token non reçu:', authData)
      return new Response(
        JSON.stringify({ error: 'JWT token non reçu de PayGreen' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Séparer prénom/nom (PayGreen exige lastName non vide)
    const nameParts = name.trim().split(' ')
    const firstName = nameParts[0] || 'Client'
    const lastName = nameParts.slice(1).join(' ') || nameParts[0] || 'Beyrouth'

    // Étape 2 : Créer la requête de paiement Paygreen (API v3)
    const paygreenPayload = {
      reference: orderNum,
      amount: total, // Déjà en centimes
      currency: 'eur',
      mode: 'instant',
      auto_capture: true,
      shop_id: PAYGREEN_SHOP_ID,
      description: `Commande ${orderNum} - Beyrouth Express`,
      return_url: `https://beyrouth.express/commande.html?num=${orderNum}&status=success`,
      cancel_url: `https://beyrouth.express/commande.html?num=${orderNum}&status=cancelled`,
      buyer: {
        email: email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || ''
      },
      metadata: {
        pickup_time: pickup || 'asap',
        note: note || '',
        items_count: items?.length || 0
      }
    }

    // Appeler l'API Paygreen avec JWT token
    const paygreenResponse = await fetch(PAYGREEN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(paygreenPayload)
    })

    if (!paygreenResponse.ok) {
      const errorText = await paygreenResponse.text()
      console.error('Erreur Paygreen:', paygreenResponse.status, errorText)

      // Essayer de parser l'erreur JSON de Paygreen
      let paygreenError = errorText
      try {
        const errorJson = JSON.parse(errorText)
        paygreenError = errorJson.message || errorJson.error || errorText
      } catch (e) {
        // Si pas JSON, utiliser le texte brut
      }

      return new Response(
        JSON.stringify({
          error: `Paygreen (${paygreenResponse.status}): ${paygreenError}`
        }),
        {
          status: paygreenResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const paygreenData = await paygreenResponse.json()
    console.log('PayGreen response:', JSON.stringify(paygreenData))

    // Extraire les données (PayGreen peut renvoyer {data: {...}} ou directement {...})
    const paymentOrder = paygreenData.data || paygreenData
    const paymentUrl = paymentOrder.hosted_payment_url || paymentOrder.url
    const transactionId = paymentOrder.id
    const objectSecret = paymentOrder.object_secret

    if (!transactionId || !objectSecret) {
      console.error('Données PayGreen invalides:', paygreenData)
      return new Response(
        JSON.stringify({
          error: 'Réponse PayGreen invalide',
          debug: paygreenData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mettre à jour la commande avec l'ID de transaction Paygreen
    await supabase
      .from('orders')
      .update({
        paygreen_transaction_id: transactionId,
        paygreen_status: 'pending'
      })
      .eq('numero', orderNum)

    return new Response(
      JSON.stringify({
        paymentOrderId: transactionId,
        objectSecret: objectSecret,
        paymentUrl: paymentUrl // Fallback pour compatibilité
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
