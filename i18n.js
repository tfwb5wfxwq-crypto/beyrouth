/**
 * Système i18n pour Beyrouth Express
 * Gère français et anglais avec détection auto + switch manuel
 */

// Traductions complètes FR/EN
const translations = {
  fr: {
    // SEO & Meta
    meta: {
      title: "A Beyrouth — Restaurant Libanais La Défense | Click & Collect",
      description: "Restaurant libanais A Beyrouth à La Défense Courbevoie. Commandez en ligne : shawarma, mezze, grillades, falafel. Retrait express 15 min. Cartes restaurant acceptées (Swile, Ticket Restaurant, Conecs).",
      ogTitle: "A Beyrouth — Restaurant Libanais La Défense",
      ogDescription: "Cuisine libanaise authentique à La Défense. Commandez en ligne, retirez en 15 min. Cartes restaurant acceptées.",
      cuisine: "Libanaise",
      paymentMethods: "Carte bancaire, Swile, Ticket Restaurant, Restoflash, Conecs"
    },

    // Header & Navigation
    nav: {
      orderNow: "Commander",
      menu: "Menu",
      catering: "Traiteur",
      contact: "Contact"
    },

    // Timepicker & Pickup
    timepicker: {
      chooseSlot: "Choisir un créneau",
      prep15min: "~15 min de préparation",
      orChooseSlot: "ou choisir un créneau",
      pickupTime: "Retrait prévu",
      asap: "Dès que possible",
      nextSlot: "Créneau le plus proche",
      closesAt: "Ferme à",
      open: "Ouvert"
    },

    // Cart & Checkout
    cart: {
      yourOrder: "Votre commande",
      empty: "Votre panier est vide",
      add: "Ajouter",
      remove: "Retirer",
      total: "Total",
      subtotal: "Sous-total",
      optin: "Me tenir informé des offres et promotions",
      securePayment: "Paiement en ligne sécurisé (CB, carte restaurant)",
      payNow: "Payer",
      orderNow: "Commander maintenant"
    },

    // Menu Items
    menu: {
      soonAvailable: "Bientôt disponible",
      formula1: "Formule 1",
      formula1Desc: "sandwich + 2 feuilletés + boisson",
      addDrink: "Une boisson fraîche avec votre plat ?",
      from: "À partir de"
    },

    // Order Status
    status: {
      paid: "Payée",
      paidDesc: "Commande reçue et payée",
      accepted: "Acceptée",
      acceptedDesc: "Le restaurant a accepté votre commande",
      preparing: "En préparation",
      preparingDesc: "Votre commande est en cours de préparation",
      ready: "Prête !",
      readyDesc: "Venez récupérer votre commande",
      pickedUp: "Récupérée",
      pickedUpDesc: "Bon appétit !",
      cancelled: "Annulée"
    },

    // Confirmation Page
    confirmation: {
      title: "Commande confirmée — Beyrouth Express",
      paymentValidated: "Paiement validé !",
      orderRegistered: "Votre commande a été enregistrée",
      pickupTime: "Retrait prévu",
      whereToPickup: "Où récupérer",
      address: "4 Esplanade du Général de Gaulle<br>92400 Courbevoie (La Défense)",
      metro: "Sortie 4 du métro La Défense",
      examining: "Le restaurant examine votre commande.<br>Vous recevrez un email dès validation.",
      emailSent: "Email envoyé",
      willNotify: "Vous serez notifié dès validation",
      preparing: "Préparation en cours",
      readyAt: "Votre commande sera prête à",
      orderAccepted: "Commande acceptée",
      orderReady: "Votre commande est prête !",
      canPickup: "Vous pouvez venir la récupérer au restaurant",
      commandReady: "Commande prête !",
      pickupNow: "Venez la récupérer chez A Beyrouth",
      seeyouSoon: "À très bientôt chez A Beyrouth 🧆"
    },

    // Admin
    admin: {
      login: "Entrez le code admin pour accéder",
      completed: "Terminées",
      completedOrders: "Commandes terminées",
      noCompleted: "Aucune commande terminée",
      toggleDishes: "Activez/désactivez des plats individuellement. Les changements sont visibles instantanément chez les clients.",
      year: "Année",
      delaySlots: "⏸️ Décaler créneaux :",
      untilTomorrow: "🌙 Jusqu'à demain",
      reminded: "📧 Relancé il y a",
      asap: "⚡ Dès que possible",
      pickedUp: "📦 Récupérée",
      completed: "✓ Terminée",
      irreversible: "Cette action est irréversible.",
      spent: "dépensé",
      last: "dernière",
      totalSpent: "Total dépensé",
      favDishes: "🍽️ Plats préférés"
    },

    // Emails
    email: {
      orderConfirmed: "Commande confirmée",
      preparing: "On prépare votre commande",
      number: "Numéro",
      seeyouSoon: "À bientôt !",
      paymentConfirmed: "Paiement confirmé",
      paymentReceived: "✅ Paiement reçu",
      secondEmail: "Vous recevrez un second email avec le récapitulatif dès que le restaurant aura validé votre commande.",
      orderNumber: "Numéro de commande",
      scheduledTime: "Heure prévue",
      quoteReceived: "Demande bien reçue",
      answerIn48h: "Réponse sous 48h",
      requestRegistered: "✅ Demande enregistrée",
      studyRequest: "Notre équipe va étudier votre demande et vous envoyer un devis personnalisé dans les 48 heures.",
      summary: "Récapitulatif",
      eventType: "Type d'événement",
      desiredDate: "Date souhaitée",
      orderDetail: "Détail de votre commande",
      pickupLocation: "Lieu de retrait",
      atBeyrouth: "A Beyrouth",
      viewMaps: "→ Voir sur Google Maps",
      totalHT: "Total HT",
      vat10: "TVA 10%",
      totalTTC: "Total TTC",
      yourOrderReady: "Votre commande vous attend",
      reminderReady: "Rappel : votre commande est prête au retrait.",
      orderAccepted: "Commande acceptée !",
      preparing: "En cours de préparation",
      pickupCode: "Votre code de retrait",
      showCounter: "À présenter au comptoir",
      readyFor: "Sera prête pour",
      viewRoute: "📍 Voir l'itinéraire",
      preparingCare: "🍽️ On prépare votre commande avec soin",
      questions: "Des questions ? contact@beyrouth.express",
      beyrouthDesc: "A Beyrouth — Cuisine libanaise authentique"
    },

    // Catering
    catering: {
      title: "Cuisine Libanaise<br>pour vos Événements",
      customBuffets: "Buffets personnalisés pour événements pro et privés",
      delivery: "Livraison et installation possible (La Défense & environs)",
      vegOptions: "Options végétariennes et vegan",
      pricing: "À partir de 18€/pers — Minimum 10 personnes",
      formIntro: "Remplissez ce formulaire et nous vous répondrons sous 48h avec un devis personnalisé",
      professional: "Événement professionnel",
      private: "Célébration privée",
      seminar: "Séminaire / Formation",
      cocktail: "Cocktail / Réception",
      answerIn48h: "Nous vous répondrons sous 48h avec un devis personnalisé"
    },

    // Form Labels
    form: {
      name: "Votre nom",
      firstName: "Prénom",
      lastName: "Nom",
      email: "Votre email",
      phone: "Téléphone",
      company: "Nom de la société",
      eventType: "Type d'événement",
      guests: "Nombre de personnes",
      date: "Date souhaitée",
      message: "Votre message",
      submit: "Envoyer",
      generateInvoice: "Générer ma facture",
      enterOrderNumber: "Entrez votre numéro de commande"
    },

    // Messages & Notifications
    messages: {
      orderNotFound: "Commande introuvable. Vérifiez le numéro.",
      invoiceGenerated: "✅ Facture générée",
      generatingInvoice: "📄 Génération de facture",
      emailConfirmSent: "Email de confirmation envoyé",
      enjoyMeal: "Bon appétit !",
      thankYou: "Merci et à bientôt !",
      detail: "Détail"
    },

    // Footer
    footer: {
      address: "4 Esplanade du Général de Gaulle, 92400 Courbevoie",
      metro: "Sortie 4 du métro"
    }
  },

  en: {
    // SEO & Meta
    meta: {
      title: "A Beyrouth — Lebanese Restaurant La Défense | Click & Collect",
      description: "A Beyrouth Lebanese restaurant in La Défense Courbevoie. Order online: shawarma, mezze, grills, falafel. Express pickup 15 min. Restaurant vouchers accepted (Swile, Ticket Restaurant, Conecs).",
      ogTitle: "A Beyrouth — Lebanese Restaurant La Défense",
      ogDescription: "Authentic Lebanese cuisine in La Défense. Order online, pick up in 15 min. Restaurant vouchers accepted.",
      cuisine: "Lebanese",
      paymentMethods: "Credit card, Swile, Ticket Restaurant, Restoflash, Conecs"
    },

    // Header & Navigation
    nav: {
      orderNow: "Order Now",
      menu: "Menu",
      catering: "Catering",
      contact: "Contact"
    },

    // Timepicker & Pickup
    timepicker: {
      chooseSlot: "Choose a time slot",
      prep15min: "~15 min preparation",
      orChooseSlot: "or choose a time slot",
      pickupTime: "Pickup time",
      asap: "As soon as possible",
      nextSlot: "Next available slot",
      closesAt: "Closes at",
      open: "Open"
    },

    // Cart & Checkout
    cart: {
      yourOrder: "Your Order",
      empty: "Your cart is empty",
      add: "Add",
      remove: "Remove",
      total: "Total",
      subtotal: "Subtotal",
      optin: "Keep me informed of offers and promotions",
      securePayment: "Secure online payment (credit card, restaurant voucher)",
      payNow: "Pay Now",
      orderNow: "Order Now"
    },

    // Menu Items
    menu: {
      soonAvailable: "Available soon",
      formula1: "Combo 1",
      formula1Desc: "sandwich + 2 pastries + drink",
      addDrink: "A refreshing drink with your meal?",
      from: "From"
    },

    // Order Status
    status: {
      paid: "Paid",
      paidDesc: "Order received and paid",
      accepted: "Accepted",
      acceptedDesc: "The restaurant accepted your order",
      preparing: "Preparing",
      preparingDesc: "Your order is being prepared",
      ready: "Ready!",
      readyDesc: "Come pick up your order",
      pickedUp: "Picked up",
      pickedUpDesc: "Enjoy your meal!",
      cancelled: "Cancelled"
    },

    // Confirmation Page
    confirmation: {
      title: "Order Confirmed — Beyrouth Express",
      paymentValidated: "Payment validated!",
      orderRegistered: "Your order has been registered",
      pickupTime: "Scheduled pickup",
      whereToPickup: "Where to pick up",
      address: "4 Esplanade du Général de Gaulle<br>92400 Courbevoie (La Défense)",
      metro: "Metro Exit 4 La Défense",
      examining: "The restaurant is reviewing your order.<br>You will receive an email upon confirmation.",
      emailSent: "Email sent",
      willNotify: "You will be notified upon confirmation",
      preparing: "Preparation in progress",
      readyAt: "Your order will be ready at",
      orderAccepted: "Order accepted",
      orderReady: "Your order is ready!",
      canPickup: "You can pick it up at the restaurant",
      commandReady: "Order ready!",
      pickupNow: "Come pick it up at A Beyrouth",
      seeyouSoon: "See you soon at A Beyrouth 🧆"
    },

    // Admin
    admin: {
      login: "Enter admin code to access",
      completed: "Completed",
      completedOrders: "Completed orders",
      noCompleted: "No completed orders",
      toggleDishes: "Enable/disable dishes individually. Changes are visible instantly to customers.",
      year: "Year",
      delaySlots: "⏸️ Delay slots:",
      untilTomorrow: "🌙 Until tomorrow",
      reminded: "📧 Reminded",
      asap: "⚡ ASAP",
      pickedUp: "📦 Picked up",
      completed: "✓ Completed",
      irreversible: "This action is irreversible.",
      spent: "spent",
      last: "last",
      totalSpent: "Total spent",
      favDishes: "🍽️ Favorite dishes"
    },

    // Emails
    email: {
      orderConfirmed: "Order confirmed",
      preparing: "We're preparing your order",
      number: "Number",
      seeyouSoon: "See you soon!",
      paymentConfirmed: "Payment confirmed",
      paymentReceived: "✅ Payment received",
      secondEmail: "You will receive a second email with the summary once the restaurant has validated your order.",
      orderNumber: "Order number",
      scheduledTime: "Scheduled time",
      quoteReceived: "Request received",
      answerIn48h: "Answer within 48h",
      requestRegistered: "✅ Request registered",
      studyRequest: "Our team will review your request and send you a personalized quote within 48 hours.",
      summary: "Summary",
      eventType: "Event type",
      desiredDate: "Desired date",
      orderDetail: "Order details",
      pickupLocation: "Pickup location",
      atBeyrouth: "A Beyrouth",
      viewMaps: "→ View on Google Maps",
      totalHT: "Total excl. VAT",
      vat10: "VAT 10%",
      totalTTC: "Total incl. VAT",
      yourOrderReady: "Your order is waiting for you",
      reminderReady: "Reminder: your order is ready for pickup.",
      orderAccepted: "Order accepted!",
      preparing: "Being prepared",
      pickupCode: "Your pickup code",
      showCounter: "Show at the counter",
      readyFor: "Will be ready for",
      viewRoute: "📍 View route",
      preparingCare: "🍽️ We're preparing your order with care",
      questions: "Questions? contact@beyrouth.express",
      beyrouthDesc: "A Beyrouth — Authentic Lebanese cuisine"
    },

    // Catering
    catering: {
      title: "Lebanese Cuisine<br>for Your Events",
      customBuffets: "Custom buffets for professional and private events",
      delivery: "Delivery and setup available (La Défense & surroundings)",
      vegOptions: "Vegetarian and vegan options",
      pricing: "From €18/person — Minimum 10 people",
      formIntro: "Fill out this form and we'll get back to you within 48h with a personalized quote",
      professional: "Professional event",
      private: "Private celebration",
      seminar: "Seminar / Training",
      cocktail: "Cocktail / Reception",
      answerIn48h: "We'll get back to you within 48h with a personalized quote"
    },

    // Form Labels
    form: {
      name: "Your name",
      firstName: "First name",
      lastName: "Last name",
      email: "Your email",
      phone: "Phone",
      company: "Company name",
      eventType: "Event type",
      guests: "Number of guests",
      date: "Desired date",
      message: "Your message",
      submit: "Submit",
      generateInvoice: "Generate invoice",
      enterOrderNumber: "Enter your order number"
    },

    // Messages & Notifications
    messages: {
      orderNotFound: "Order not found. Check the number.",
      invoiceGenerated: "✅ Invoice generated",
      generatingInvoice: "📄 Generating invoice",
      emailConfirmSent: "Confirmation email sent",
      enjoyMeal: "Enjoy your meal!",
      thankYou: "Thank you and see you soon!",
      detail: "Details"
    },

    // Footer
    footer: {
      address: "4 Esplanade du Général de Gaulle, 92400 Courbevoie",
      metro: "Metro Exit 4"
    }
  }
};

// État actuel de la langue
let currentLang = 'fr';

/**
 * Détecte la langue du navigateur
 */
function detectBrowserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage;
  // Si c'est anglais (en, en-US, en-GB...), retourner 'en', sinon 'fr'
  return browserLang.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

/**
 * Initialise la langue au chargement
 */
function initLanguage() {
  // 1. Vérifier le localStorage (choix manuel)
  const savedLang = localStorage.getItem('beyrouth_lang');

  if (savedLang && (savedLang === 'fr' || savedLang === 'en')) {
    currentLang = savedLang;
  } else {
    // 2. Détection automatique navigateur
    currentLang = detectBrowserLanguage();
    localStorage.setItem('beyrouth_lang', currentLang);
  }

  return currentLang;
}

/**
 * Change la langue et recharge les traductions
 */
function setLanguage(lang) {
  if (lang !== 'fr' && lang !== 'en') return;

  currentLang = lang;
  localStorage.setItem('beyrouth_lang', lang);

  // Trigger event pour que les pages écoutent
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));

  // Appliquer les traductions
  applyTranslations();
}

/**
 * Retourne la langue actuelle
 */
function getCurrentLanguage() {
  return currentLang;
}

/**
 * Retourne une traduction par clé (ex: "cart.total")
 */
function t(key) {
  const keys = key.split('.');
  let value = translations[currentLang];

  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      return key; // Clé non trouvée, retourner la clé elle-même
    }
  }

  return value || key;
}

/**
 * Applique les traductions aux éléments data-i18n
 */
function applyTranslations() {
  // Traduire les éléments avec data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = t(key);

    if (el.hasAttribute('data-i18n-placeholder')) {
      el.placeholder = translation;
    } else if (el.hasAttribute('data-i18n-html')) {
      el.innerHTML = translation;
    } else {
      el.textContent = translation;
    }
  });

  // Mettre à jour le HTML lang
  document.documentElement.lang = currentLang;

  // Mettre à jour les meta tags
  document.title = t('meta.title');
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.content = t('meta.description');
}

// Export pour utilisation dans les autres scripts
window.i18n = {
  init: initLanguage,
  set: setLanguage,
  get: getCurrentLanguage,
  t: t,
  apply: applyTranslations,
  translations: translations
};
