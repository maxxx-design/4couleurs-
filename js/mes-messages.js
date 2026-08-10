// mes-messages.js — messagerie à 2 colonnes façon Leboncoin/Vinted
// (fusionne ce qui était avant sur mes-messages.html et conversation.html)

let monIdMessagerie = null;
let conversationActiveId = null;

(async function initMesMessages() {
  const session = await verifierConnexion();
  if (!session) return; // la popup de connexion gère déjà l'accès
  monIdMessagerie = session.user.id;

  await chargerListeConversations();

  const params = new URLSearchParams(window.location.search);
  const conversationDemandee = params.get("conversation");
  if (conversationDemandee) {
    await ouvrirConversation(conversationDemandee);
  }
})();

async function chargerListeConversations() {
  const container = document.getElementById("liste-conversations");

  const { data: conversations, error } = await supabaseClient
    .from("conversations")
    .select(`
      id, created_at, type, annonce_id, stylo_id, participant_1, participant_2,
      annonces:annonce_id ( stylo_id, stylos ( nom, photos(storage_path) ) ),
      stylo_direct:stylo_id ( nom, photos(storage_path) )
    `)
    .or(`participant_1.eq.${monIdMessagerie},participant_2.eq.${monIdMessagerie}`)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "<p style='padding:1rem;'>Erreur : " + error.message + "</p>";
    console.error(error);
    return;
  }
  if (!conversations || conversations.length === 0) {
    container.innerHTML = "<p style='padding:1rem;'>Aucune conversation pour l'instant.</p>";
    return;
  }

  const infos = await Promise.all(conversations.map(c => construireInfosConversation(c)));

  container.innerHTML = infos.map(info => `
    <a href="#" class="item-conversation ${info.id === conversationActiveId ? 'actif' : ''}" onclick="event.preventDefault(); ouvrirConversation('${info.id}')">
      ${info.urlPhoto
        ? `<img src="${info.urlPhoto}" alt="${info.nomProduit || ''}" class="miniature-produit">`
        : `<div class="miniature-manquante"></div>`
      }
      <div class="item-conversation-infos">
        <p class="item-conversation-nom">${info.autrePseudo}</p>
        ${info.nomProduit ? `<p class="item-conversation-produit">${info.nomProduit}</p>` : ""}
        <p class="item-conversation-dernier">${info.dernierMessage}</p>
      </div>
    </a>
  `).join("");
}

async function construireInfosConversation(conv) {
  const autreId = conv.participant_1 === monIdMessagerie ? conv.participant_2 : conv.participant_1;

  const { data: profilAutre } = await supabaseClient
    .from("profils")
    .select("pseudo")
    .eq("id", autreId)
    .maybeSingle();

  const { data: dernierMessage } = await supabaseClient
    .from("messages")
    .select("contenu")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nomProduit = null;
  let urlPhoto = null;
  if (conv.annonces && conv.annonces.stylos) {
    nomProduit = conv.annonces.stylos.nom;
    urlPhoto = obtenirUrlPhoto(conv.annonces.stylos);
  } else if (conv.stylo_direct) {
    nomProduit = conv.stylo_direct.nom;
    urlPhoto = obtenirUrlPhoto(conv.stylo_direct);
  }

  return {
    id: conv.id,
    autreId,
    autrePseudo: profilAutre ? profilAutre.pseudo : "Utilisateur",
    dernierMessage: dernierMessage ? dernierMessage.contenu : "Nouvelle conversation",
    nomProduit,
    urlPhoto
  };
}

async function ouvrirConversation(conversationId) {
  conversationActiveId = conversationId;
  await chargerListeConversations(); // pour surligner l'item actif

  const zone = document.getElementById("zone-conversation");
  zone.innerHTML = `<p>Chargement...</p>`;

  const { data: conversation, error } = await supabaseClient
    .from("conversations")
    .select(`
      id, type, annonce_id, stylo_id, participant_1, participant_2,
      annonces:annonce_id ( id, statut, vendeur_id, acheteur_id, stylos(nom) ),
      stylo_direct:stylo_id ( nom )
    `)
    .eq("id", conversationId)
    .single();

  if (error || !conversation) {
    zone.innerHTML = `<p>Conversation introuvable.</p>`;
    return;
  }

  const autreId = conversation.participant_1 === monIdMessagerie ? conversation.participant_2 : conversation.participant_1;
  const { data: profilAutre } = await supabaseClient
    .from("profils")
    .select("pseudo")
    .eq("id", autreId)
    .maybeSingle();

  const nomProduit = conversation.annonces?.stylos?.nom || conversation.stylo_direct?.nom || null;

  zone.innerHTML = `
    <div class="zone-conversation-entete">
      <p style="margin:0; font-weight:600;">
        <a href="profil.html?id=${autreId}" style="color:inherit;">${profilAutre ? profilAutre.pseudo : "Utilisateur"}</a>
      </p>
      ${nomProduit ? `<p style="margin:0.2rem 0 0; font-size:0.85rem; color:#6B6558;">${nomProduit}</p>` : ""}
    </div>
    <div id="zone-actions-conversation"></div>
    <div id="fil-messages-conversation" class="zone-conversation-messages"></div>
    <form id="form-message-conversation" class="formulaire" style="max-width:none;">
      <label>Message
        <textarea id="contenu-message-conversation" required></textarea>
      </label>
      <button type="submit">Envoyer</button>
      <p id="message-erreur-conversation"></p>
    </form>
  `;

  await afficherZoneActionsAnnonce(conversation, autreId);
  await chargerMessagesConversation(conversationId);

  document.getElementById("form-message-conversation").addEventListener("submit", async (e) => {
    e.preventDefault();
    const contenu = document.getElementById("contenu-message-conversation").value;
    const messageErreur = document.getElementById("message-erreur-conversation");
    const { error } = await supabaseClient.from("messages").insert({
      conversation_id: conversationId,
      expediteur_id: monIdMessagerie,
      contenu: contenu
    });
    if (error) {
      messageErreur.textContent = "Erreur : " + error.message;
      messageErreur.style.color = "red";
      return;
    }
    document.getElementById("contenu-message-conversation").value = "";
    messageErreur.textContent = "";
    await chargerMessagesConversation(conversationId);
    await chargerListeConversations();
  });
}

async function chargerMessagesConversation(conversationId) {
  const filMessages = document.getElementById("fil-messages-conversation");
  const { data: messages, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    filMessages.innerHTML = "<p>Erreur : " + error.message + "</p>";
    return;
  }
  if (!messages || messages.length === 0) {
    filMessages.innerHTML = "<p>Aucun message pour l'instant, lance la discussion !</p>";
    return;
  }
  filMessages.innerHTML = messages.map(m => `
    <div class="message ${m.expediteur_id === monIdMessagerie ? 'message-moi' : 'message-autre'}">
      <p>${m.contenu}</p>
    </div>
  `).join("");
  filMessages.scrollTop = filMessages.scrollHeight;
}

// Actions liées à une annonce (marquer vendue / évaluer) — absentes pour les messages système
async function afficherZoneActionsAnnonce(conversation, autreParticipantId) {
  const zoneActions = document.getElementById("zone-actions-conversation");
  const annonce = conversation.annonces;

  if (conversation.type !== "annonce" || !annonce) {
    zoneActions.innerHTML = "";
    return;
  }

  if (annonce.vendeur_id === monIdMessagerie && annonce.statut === "active") {
    zoneActions.innerHTML = `
      <p><strong>${annonce.stylos.nom}</strong> — annonce active</p>
      <button class="bouton-vendre" id="bouton-marquer-vendue">Marquer comme vendue à cette personne</button>
    `;
    document.getElementById("bouton-marquer-vendue").addEventListener("click", async () => {
      const confirmation = confirm("Confirmer la vente à cette personne ?");
      if (!confirmation) return;
      const { error } = await supabaseClient
        .from("annonces")
        .update({ statut: "vendue", acheteur_id: autreParticipantId })
        .eq("id", annonce.id);
      if (error) { alert("Erreur : " + error.message); return; }
      await ouvrirConversation(conversation.id);
    });
    return;
  }

  const jeSuisConcerne = annonce.vendeur_id === monIdMessagerie || annonce.acheteur_id === monIdMessagerie;
  const autrePersonneEstAcheteurOuVendeur = annonce.acheteur_id === autreParticipantId || annonce.vendeur_id === autreParticipantId;

  if (annonce.statut === "vendue" && jeSuisConcerne && autrePersonneEstAcheteurOuVendeur) {
    const { data: evaluationExistante } = await supabaseClient
      .from("evaluations")
      .select("id")
      .eq("annonce_id", annonce.id)
      .eq("evaluateur_id", monIdMessagerie)
      .maybeSingle();

    if (evaluationExistante) {
      zoneActions.innerHTML = `<p>Transaction conclue — tu as déjà laissé une évaluation.</p>`;
      return;
    }

    zoneActions.innerHTML = `
      <p>Transaction conclue pour <strong>${annonce.stylos.nom}</strong></p>
      <button class="bouton-vendre" id="bouton-evaluer">Laisser une évaluation</button>
    `;
    document.getElementById("bouton-evaluer").addEventListener("click", async () => {
      const note = prompt("Note sur 5 (1 à 5) :");
      const noteNombre = parseInt(note);
      if (!noteNombre || noteNombre < 1 || noteNombre > 5) { alert("Note invalide."); return; }
      const commentaire = prompt("Un commentaire (optionnel) :") || null;
      const { error } = await supabaseClient.from("evaluations").insert({
        annonce_id: annonce.id,
        evaluateur_id: monIdMessagerie,
        evalue_id: autreParticipantId,
        note: noteNombre,
        commentaire: commentaire
      });
      if (error) { alert("Erreur : " + error.message); return; }
      alert("Évaluation envoyée, merci !");
      await ouvrirConversation(conversation.id);
    });
    return;
  }

  zoneActions.innerHTML = "";
}