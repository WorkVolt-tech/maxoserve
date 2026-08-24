export const helpTopics = {
  en: [
    {
      section: 'Getting Started',
      items: [
        {
          title: 'Setting up your venue',
          body: 'Start with Locations (each physical address you operate), then Areas (rooms/sections within a location, like "Main Floor" or "VIP"), then Tables (individual tables within an area). Each level depends on the one before it.',
        },
        {
          title: 'Generating QR codes',
          body: 'On the Tables page, click "Generate QR" on any table to create its unique code. Click "View QR" to see, download, or print it. Use "Regenerate All QR Codes" to refresh every code in an area or location at once — useful if codes were compromised or you want a clean start.',
        },
        {
          title: 'Switching locations',
          body: 'If your business has more than one location, use the switcher in the top bar to change which one you\'re working in. Most pages (Areas, Tables, Menu, Reservations, Events) follow whichever location is currently selected.',
        },
      ],
    },
    {
      section: 'Menu & Modifiers',
      items: [
        {
          title: 'Building your menu',
          body: 'Menu Categories organize your menu (Appetizers, Cocktails, etc.). Click into a category to add individual items with a name, price, and optional description. You can also bulk-import a menu from a CSV/XLSX file using the "Import from File" button.',
        },
        {
          title: 'Modifiers (customizations)',
          body: 'Modifiers are reusable customization groups, like "Choose Mixer" or "Add-ons," that attach to menu items. Create a modifier group once, then attach it to as many items as you like from that item\'s detail view.',
        },
        {
          title: 'Cost & margin tracking',
          body: 'Enter a cost alongside an item\'s price to see live profit margin on that item. Visit Margin Report in the sidebar for a full breakdown across your whole menu.',
        },
        {
          title: 'Bilingual menu content',
          body: 'Category names, item names/descriptions, modifier names, and request button labels all support an optional French translation field. If left blank, the English version is shown to French-speaking customers.',
        },
      ],
    },
    {
      section: 'Staff & Permissions',
      items: [
        {
          title: 'Inviting staff',
          body: 'On the Staff page, invite someone by email and set their role. If they don\'t have an account yet, they\'ll automatically join your business the moment they sign up with that email.',
        },
        {
          title: 'Inviting an existing user (cross-business access)',
          body: 'If someone already has a MaxoServe account elsewhere, use "Invite Existing User" instead. You can grant permanent access or temporary access for a set number of hours — perfect for a one-off shift or event.',
        },
        {
          title: 'Assigning staff to tables/areas',
          body: 'The Assignments page lets you assign a staff member to a specific table, a whole area, or an entire location.',
        },
      ],
    },
    {
      section: 'Live Operations',
      items: [
        {
          title: 'Live Requests dashboard',
          body: 'Staff use the Live Requests page (linked from the sidebar) to see and respond to customer service requests in real time — Accept, mark On My Way, then Complete.',
        },
        {
          title: 'Managing orders',
          body: 'The Orders page shows all customer orders in real time. Filter by station (Kitchen/Bar/Bottle Service) or use "Group by Table" to see everything one table has ordered in one place.',
        },
        {
          title: 'Floor plan',
          body: 'Drag tables to arrange your floor layout visually. Scroll to zoom, drag the background to pan, and use the zoom buttons or reset view for a busy floor.',
        },
      ],
    },
    {
      section: 'Reservations & Events',
      items: [
        {
          title: 'Taking reservations',
          body: 'Create a reservation with customer details, party size, and time. Assign a table once one\'s available, and optionally build a pre-order so their order is ready when they arrive.',
        },
        {
          title: 'Events',
          body: 'Create temporary events (weddings, private parties) and link reservations to them for easier tracking.',
        },
      ],
    },
    {
      section: 'Customization',
      items: [
        {
          title: 'Request buttons',
          body: 'Control which service buttons customers see (Call Server, Request Bill, etc.) and which staff role each one routes to.',
        },
        {
          title: 'Service/Menu tab toggle',
          body: 'In Settings, choose whether customers see the Service tab, the Menu tab, or both when they scan a QR code.',
        },
        {
          title: 'Business logo',
          body: 'Paste a link to your logo image in Settings. It appears on your customer table page and on printable QR templates.',
        },
      ],
    },
  ],
  fr: [
    {
      section: 'Pour commencer',
      items: [
        {
          title: 'Configurer votre établissement',
          body: 'Commencez par les Emplacements (chaque adresse physique où vous opérez), puis les Zones (salles/sections au sein d\'un emplacement, comme « Salle principale » ou « VIP »), puis les Tables (tables individuelles au sein d\'une zone). Chaque niveau dépend du précédent.',
        },
        {
          title: 'Générer des codes QR',
          body: 'Sur la page Tables, cliquez sur « Générer le QR » pour créer le code unique d\'une table. Cliquez sur « Voir le QR » pour le voir, le télécharger ou l\'imprimer. Utilisez « Régénérer tous les codes QR » pour rafraîchir tous les codes d\'une zone ou d\'un emplacement à la fois.',
        },
        {
          title: 'Changer d\'emplacement',
          body: 'Si votre entreprise compte plus d\'un emplacement, utilisez le sélecteur dans la barre supérieure pour changer celui sur lequel vous travaillez. La plupart des pages suivent l\'emplacement actuellement sélectionné.',
        },
      ],
    },
    {
      section: 'Menu et modificateurs',
      items: [
        {
          title: 'Construire votre menu',
          body: 'Les catégories de menu organisent votre menu (Entrées, Cocktails, etc.). Cliquez sur une catégorie pour ajouter des articles individuels avec un nom, un prix et une description facultative. Vous pouvez aussi importer un menu en masse depuis un fichier CSV/XLSX avec le bouton « Importer un fichier ».',
        },
        {
          title: 'Modificateurs (personnalisations)',
          body: 'Les modificateurs sont des groupes de personnalisation réutilisables, comme « Choisir le mélangeur » ou « Suppléments », qui s\'attachent aux articles du menu. Créez un groupe une fois, puis attachez-le à autant d\'articles que vous le souhaitez.',
        },
        {
          title: 'Suivi des coûts et marges',
          body: 'Saisissez un coût à côté du prix d\'un article pour voir la marge bénéficiaire en direct. Consultez le Rapport de marge dans la barre latérale pour une analyse complète de votre menu.',
        },
        {
          title: 'Contenu de menu bilingue',
          body: 'Les noms de catégories, noms/descriptions d\'articles, noms de modificateurs et libellés de boutons de demande prennent tous en charge un champ de traduction française facultatif. S\'il est vide, la version anglaise est affichée aux clients francophones.',
        },
      ],
    },
    {
      section: 'Personnel et permissions',
      items: [
        {
          title: 'Inviter du personnel',
          body: 'Sur la page Personnel, invitez quelqu\'un par courriel et définissez son rôle. S\'il n\'a pas encore de compte, il rejoindra automatiquement votre entreprise dès qu\'il s\'inscrira avec ce courriel.',
        },
        {
          title: 'Inviter un utilisateur existant (accès multi-entreprise)',
          body: 'Si quelqu\'un a déjà un compte MaxoServe ailleurs, utilisez « Inviter un utilisateur existant ». Vous pouvez accorder un accès permanent ou temporaire pour un nombre d\'heures défini.',
        },
        {
          title: 'Affecter le personnel aux tables/zones',
          body: 'La page Affectations vous permet d\'affecter un membre du personnel à une table précise, une zone entière ou un emplacement entier.',
        },
      ],
    },
    {
      section: 'Opérations en direct',
      items: [
        {
          title: 'Tableau des demandes en direct',
          body: 'Le personnel utilise la page Demandes en direct pour voir et répondre aux demandes de service des clients en temps réel — Accepter, marquer En chemin, puis Terminer.',
        },
        {
          title: 'Gérer les commandes',
          body: 'La page Commandes affiche toutes les commandes des clients en temps réel. Filtrez par poste (Cuisine/Bar/Service de bouteilles) ou utilisez « Grouper par table ».',
        },
        {
          title: 'Plan de salle',
          body: 'Faites glisser les tables pour organiser visuellement votre plan de salle. Défilez pour zoomer, faites glisser l\'arrière-plan pour vous déplacer.',
        },
      ],
    },
    {
      section: 'Réservations et événements',
      items: [
        {
          title: 'Prendre des réservations',
          body: 'Créez une réservation avec les détails du client, la taille du groupe et l\'heure. Attribuez une table dès qu\'elle est disponible, et créez éventuellement une précommande.',
        },
        {
          title: 'Événements',
          body: 'Créez des événements temporaires (mariages, soirées privées) et liez-y des réservations pour un suivi facilité.',
        },
      ],
    },
    {
      section: 'Personnalisation',
      items: [
        {
          title: 'Boutons de demande',
          body: 'Contrôlez quels boutons de service les clients voient et vers quel rôle du personnel chacun est dirigé.',
        },
        {
          title: 'Bascule des onglets Service/Menu',
          body: 'Dans Paramètres, choisissez si les clients voient l\'onglet Service, l\'onglet Menu, ou les deux.',
        },
        {
          title: 'Logo de l\'entreprise',
          body: 'Collez un lien vers votre logo dans Paramètres. Il apparaît sur la page de table des clients et sur les modèles QR imprimables.',
        },
      ],
    },
  ],
}
