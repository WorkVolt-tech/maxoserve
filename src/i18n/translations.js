export const translations = {
  en: {
    // Venue header
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    howCanWeHelp: 'How can we help?',
    welcome: 'Welcome',

    // Tabs
    service: 'Service',
    menu: 'Menu',
    orders: 'Orders',

    // Service requests
    requestSent: 'Request sent',
    accepted: 'Accepted',
    onTheWay: 'On the way',
    completed: 'Completed',
    unableToAssist: 'Unable to assist',
    cancelled: 'Cancelled',
    alreadyActiveRequest: 'You already have an active request for this.',
    noServiceButtons: 'No service buttons have been set up yet.',

    // Menu
    menuNotAvailable: "The menu isn't available yet.",
    noItemsInCategory: 'No items in this category.',
    addToOrder: 'Add to Order',
    specialInstructions: 'Special instructions (optional)',
    required: 'required',
    viewCart: 'View Cart',

    // Cart
    yourOrder: 'Your Order',
    cartEmpty: 'Your cart is empty.',
    subtotal: 'Subtotal',
    tax: 'Tax',
    total: 'Total',
    placeOrder: 'Place Order',
    placingOrder: 'Placing Order…',
    confirmOrderPrefix: 'Your order total is',
    confirmOrderSuffix: '. Confirm order?',

    // Orders tab
    noOrdersYet: 'No orders yet this visit.',
    items: 'item(s)',
    submitted: 'Submitted',
    preparing: 'Preparing',
    ready: 'Ready',
    delivered: 'Delivered',
    rejected: 'Rejected',

    // Errors / status pages
    qrInactiveTitle: 'This QR code is no longer active',
    qrInactiveBody: 'Please ask a staff member for a new code, or check with the venue.',
    somethingWrong: 'Something went wrong',
  },
  fr: {
    goodMorning: 'Bonjour',
    goodAfternoon: 'Bon après-midi',
    goodEvening: 'Bonsoir',
    howCanWeHelp: 'Comment pouvons-nous vous aider ?',
    welcome: 'Bienvenue',

    service: 'Service',
    menu: 'Menu',
    orders: 'Commandes',

    requestSent: 'Demande envoyée',
    accepted: 'Acceptée',
    onTheWay: 'En chemin',
    completed: 'Terminée',
    unableToAssist: 'Impossible d\'aider',
    cancelled: 'Annulée',
    alreadyActiveRequest: 'Vous avez déjà une demande active pour ceci.',
    noServiceButtons: 'Aucun bouton de service n\'a encore été configuré.',

    menuNotAvailable: "Le menu n'est pas encore disponible.",
    noItemsInCategory: 'Aucun article dans cette catégorie.',
    addToOrder: 'Ajouter à la commande',
    specialInstructions: 'Instructions spéciales (facultatif)',
    required: 'requis',
    viewCart: 'Voir le panier',

    yourOrder: 'Votre commande',
    cartEmpty: 'Votre panier est vide.',
    subtotal: 'Sous-total',
    tax: 'Taxe',
    total: 'Total',
    placeOrder: 'Passer la commande',
    placingOrder: 'Commande en cours…',
    confirmOrderPrefix: 'Le total de votre commande est de',
    confirmOrderSuffix: '. Confirmer la commande ?',

    noOrdersYet: 'Aucune commande pour cette visite.',
    items: 'article(s)',
    submitted: 'Envoyée',
    preparing: 'En préparation',
    ready: 'Prête',
    delivered: 'Livrée',
    rejected: 'Refusée',

    qrInactiveTitle: "Ce code QR n'est plus actif",
    qrInactiveBody: 'Veuillez demander un nouveau code à un membre du personnel, ou vérifier auprès de l\'établissement.',
    somethingWrong: "Une erreur s'est produite",
  },
}

export function t(lang, key) {
  return translations[lang]?.[key] || translations.en[key] || key
}
