(async function initModeration() {
  const session = await verifierConnexion();
  const zoneRefus = document.getElementById("zone-refus");
  const zoneModeration = document.getElementById("zone-moderation");

  if (!session) {
    zoneRefus.style.display = "block";
    return;
  }

  const { data: profil } = await supabaseClient
    .from("profils")
    .select("est_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profil || !profil.est_admin) {
    zoneRefus.style.display = "block";
    return;
  }

  zoneModeration.style.display = "block";
  await chargerStylosEnAttente();
  await chargerAnnoncesEnAttente();

  async function chargerStylosEnAttente() {
    const container = document.getElementById("liste-stylos-attente");
    const { data: stylos, error } = await supabaseClient
      .from("stylos")
      .select("id, nom, lieu_ou_entreprise, ville, pays, rarete, raison_moderation, cree_par")
      .eq("statut_moderation", "en_attente")
      .order("created_at", { ascending: true });

    if (error) {
      container.innerHTML = "<p>Erreur : " + error.message + "</p>";
      return;
    }
    if (!stylos || stylos.length === 0) {
      container.innerHTML = "<p>Aucune fiche en attente.</p>";
      return;
    }

    container.innerHTML = stylos.map(stylo => `
      <div class="carte-stylo">
        <h3>${stylo.nom}</h3>
        <p>${stylo.lieu_ou_entreprise}</p>
        <p>${stylo.ville || ""} ${stylo.pays || ""}</p>
        <p class="rarete">${stylo.rarete}</p>
        <p class="badge-raison">${stylo.raison_moderation || "Nouvelle fiche à vérifier"}</p>
        <button class="bouton-vendre" onclick="validerStylo('${stylo.id}', '${stylo.cree_par}', '${stylo.nom.replace(/'/g, "\\'")}')">Valider</button>
        <button class="bouton-refuser" onclick="refuserStylo('${stylo.id}', '${stylo.cree_par}', '${stylo.nom.replace(/'/g, "\\'")}')">Refuser</button>
      </div>
    `).join("");
  }

  async function chargerAnnoncesEnAttente() {
    const container = document.getElementById("liste-annonces-attente");
    const { data: annonces, error } = await supabaseClient
      .from("annonces")
      .select("id, prix, description, vendeur_id, stylos(nom)")
      .eq("statut", "en_attente")
      .order("created_at", { ascending: true });

    if (error) {
      container.innerHTML = "<p>Erreur : " + error.message + "</p>";
      return;
    }
    if (!annonces || annonces.length === 0) {
      container.innerHTML = "<p>Aucune annonce en attente.</p>";
      return;
    }

    container.innerHTML = annonces.map(annonce => `
      <div class="carte-stylo">
        <h3>${annonce.stylos.nom}</h3>
        <p class="prix">${annonce.prix} €</p>
        <p class="badge-raison">Prix ≥ 20 € — validation manuelle requise</p>
        <p>${annonce.description || ""}</p>
        <button class="bouton-vendre" onclick="validerAnnonce('${annonce.id}', '${annonce.vendeur_id}', '${annonce.stylos.nom.replace(/'/g, "\\'")}')">Valider</button>
        <button class="bouton-refuser" onclick="refuserAnnonce('${annonce.id}', '${annonce.vendeur_id}', '${annonce.stylos.nom.replace(/'/g, "\\'")}')">Refuser</button>
      </div>
    `).join("");
  }

  // Envoie un message depuis le compte système (crée la conversation si elle n'existe pas encore)
  async function envoyerMessageSysteme(utilisateurId, message, options = {}) {
    if (!utilisateurId) return;
    const idSysteme = await obtenirIdCompteSysteme();
    if (!idSysteme) {
      console.error("Compte système introuvable — vérifie qu'un profil a est_systeme = true.");
      return;
    }

    let requete = supabaseClient
      .from("conversations")
      .select("id")
      .eq("type", "systeme")
      .eq("participant_1", idSysteme)
      .eq("participant_2", utilisateurId);
    requete = options.annonceId ? requete.eq("annonce_id", options.annonceId) : requete.is("annonce_id", null);
    requete = options.styloId ? requete.eq("stylo_id", options.styloId) : requete.is("stylo_id", null);

    const { data: existantes } = await requete;
    let conversationId;

    if (existantes && existantes.length > 0) {
      conversationId = existantes[0].id;
    } else {
      const { data: nouvelle, error } = await supabaseClient.from("conversations").insert({
        type: "systeme",
        participant_1: idSysteme,
        participant_2: utilisateurId,
        annonce_id: options.annonceId || null,
        stylo_id: options.styloId || null
      }).select().single();
      if (error) { console.error(error); return; }
      conversationId = nouvelle.id;
    }

    await supabaseClient.from("messages").insert({
      conversation_id: conversationId,
      expediteur_id: idSysteme,
      contenu: message
    });
  }

  window.validerStylo = async function (id, creePar, nom) {
    await supabaseClient.from("stylos").update({
      statut_moderation: "valide",
      valide_par: session.user.id
    }).eq("id", id);
    await envoyerMessageSysteme(creePar, `Ta fiche « ${nom} » a été validée et apparaît dans le catalogue.`, { styloId: id });
    await chargerStylosEnAttente();
  };

  window.refuserStylo = async function (id, creePar, nom) {
    await supabaseClient.from("stylos").update({
      statut_moderation: "refuse",
      valide_par: session.user.id
    }).eq("id", id);
    await envoyerMessageSysteme(creePar, `Ta fiche « ${nom} » n'a pas été validée.`, { styloId: id });
    await chargerStylosEnAttente();
  };

  window.validerAnnonce = async function (id, vendeurId, nom) {
    await supabaseClient.from("annonces").update({ statut: "active" }).eq("id", id);
    await envoyerMessageSysteme(vendeurId, `Ton annonce pour « ${nom} » est maintenant active.`, { annonceId: id });
    await chargerAnnoncesEnAttente();
  };

  window.refuserAnnonce = async function (id, vendeurId, nom) {
    await supabaseClient.from("annonces").update({ statut: "refusee" }).eq("id", id);
    await envoyerMessageSysteme(vendeurId, `Ton annonce pour « ${nom} » n'a pas été validée.`, { annonceId: id });
    await chargerAnnoncesEnAttente();
  };
})();