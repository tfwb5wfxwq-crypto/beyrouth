// Shared bilingual translations for email Edge Functions
// Used by: send-order-confirmation, send-payment-confirmation,
//          send-order-reminder, send-cancellation-email, send-order-completed

export type Lang = 'fr' | 'en'

export const emailI18n = {
  fr: {
    // Order confirmation
    orderConfirmed: '✅ Commande confirmée',
    order: 'Commande',
    pickup: 'Retrait',
    asap: 'Dès que possible',
    totalTTC: 'Total TTC',
    wherePickup: '📍 Où retirer',
    viewMaps: '📍 Voir sur Google Maps',
    metro: '🚇 La Défense · Sortie 4',
    followUs: 'Retrouvez-nous sur',

    // Payment confirmation
    paymentConfirmed: '✅ Paiement confirmé',
    awaitingValidation: 'En attente de validation',
    paymentPendingMsg: 'Vous recevrez un email de confirmation dès que le restaurant aura accepté votre commande.',
    pickupAddress: '📍 Retrait',
    openMaps: '📍 Ouvrir dans Google Maps',

    // Reminder
    orderWaiting: '⏰ Votre commande vous attend',

    // Cancellation
    orderCancelled: '❌ Commande annulée',
    reason: 'Raison',
    refundTitle: '💳 Remboursement automatique',
    refundMsg: (amount: string) => `Le montant de <strong>${amount}</strong> vous sera remboursé sous 5 à 7 jours ouvrés.`,
    contact: '📍 Contact',

    // Order completed
    thankYou: 'Merci pour votre visite !',
    orderPickedUp: (numero: string) => `Votre commande <strong>${numero}</strong> a bien été récupérée.<br>À très bientôt chez A Beyrouth !`,
    downloadReceipt: '📄 Télécharger mon reçu',

    // Google review (footer)
    yourReviewMatters: 'Votre avis compte !',
    rateUs: 'Mettez-nous 5 étoiles sur Google 🙏',
    leaveReview: '🌟 Laisser un avis',

    // Email subjects
    subjectConfirmed: (numero: string, pickup: string) => `Commande ${numero} validée · Retrait ${pickup} - A Beyrouth`,
    subjectPayment: (numero: string) => `✅ Paiement confirmé - Commande ${numero} - A Beyrouth`,
    subjectReminder: (numero: string, pickup: string) => `⏰ ${numero} · Votre commande prête depuis ${pickup} - A Beyrouth`,
    subjectCancelled: (numero: string) => `❌ Commande ${numero} annulée - Remboursement en cours`,
    subjectCompleted: (numero: string) => `Merci pour votre visite - Commande ${numero} - A Beyrouth`,
  },
  en: {
    // Order confirmation
    orderConfirmed: '✅ Order confirmed',
    order: 'Order',
    pickup: 'Pickup',
    asap: 'As soon as possible',
    totalTTC: 'Total incl. VAT',
    wherePickup: '📍 Where to pick up',
    viewMaps: '📍 View on Google Maps',
    metro: '🚇 La Défense · Exit 4',
    followUs: 'Follow us on',

    // Payment confirmation
    paymentConfirmed: '✅ Payment confirmed',
    awaitingValidation: 'Awaiting validation',
    paymentPendingMsg: 'You will receive a confirmation email once the restaurant has accepted your order.',
    pickupAddress: '📍 Pickup',
    openMaps: '📍 Open in Google Maps',

    // Reminder
    orderWaiting: '⏰ Your order is waiting for you',

    // Cancellation
    orderCancelled: '❌ Order cancelled',
    reason: 'Reason',
    refundTitle: '💳 Automatic refund',
    refundMsg: (amount: string) => `The amount of <strong>${amount}</strong> will be refunded within 5 to 7 business days.`,
    contact: '📍 Contact',

    // Order completed
    thankYou: 'Thank you for your visit!',
    orderPickedUp: (numero: string) => `Your order <strong>${numero}</strong> has been picked up.<br>See you soon at A Beyrouth!`,
    downloadReceipt: '📄 Download my receipt',

    // Google review (footer)
    yourReviewMatters: 'Your opinion matters!',
    rateUs: 'Give us 5 stars on Google 🙏',
    leaveReview: '🌟 Leave a review',

    // Email subjects
    subjectConfirmed: (numero: string, pickup: string) => `Order ${numero} confirmed · Pickup ${pickup} - A Beyrouth`,
    subjectPayment: (numero: string) => `✅ Payment confirmed - Order ${numero} - A Beyrouth`,
    subjectReminder: (numero: string, pickup: string) => `⏰ ${numero} · Your order ready since ${pickup} - A Beyrouth`,
    subjectCancelled: (numero: string) => `❌ Order ${numero} cancelled - Refund in progress`,
    subjectCompleted: (numero: string) => `Thank you for your visit - Order ${numero} - A Beyrouth`,
  }
}

export function t(lang: Lang) {
  return emailI18n[lang] ?? emailI18n.fr
}
