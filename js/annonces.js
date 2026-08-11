// annonces.js — popup de détail, favoris publics, vues réservées au vendeur

let idsFavorisAnnonces = new Set();
let monIdUtilisateurAnnonces = null;
let toutesLesAnnonces = [];
let monEstAdmin = false;

async function chargerAnnonces() {
  const container = document.getElementById("liste-annonces");
  const sessionFavoris = await verifierConnexion();

  if (sessionFavoris) {
    monIdUtilisateurAnnonces = sessionFavoris.user.id;
    const { data: profilConnecte } = await supabaseClient
      .from("profils")
      .select("est_admin")
      .eq("id", monIdUtilisateurAnnonces)
      .maybeSingle();
    monEstAdmin = profilConnecte ? profilConnecte.est_admin : false;
    const { data: favoris } = await supabaseClient
      .from("favoris")
      .select("stylo_id")
      .eq("utilisateur_id", monIdUtilisateurAnnonces);
    if (favoris) idsFavorisAnnonces = new Set(favoris.map(f => f.stylo_id));
  }

  const { data: annonces, error } = await supabaseClient
    .from("annonces")
    .select("id, stylo_id, prix, description, vendeur_id, vues, stylos(nom, lieu_ou_entreprise, ville, pays, rarete, description, photos(storage_path, est_principale)), vendeur:vendeur_id(pseudo)")
    .eq("statut", "active")
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "<p>Erreur de chargement : " + error.message + "</p>";
    console.error(error);
    return;
  }

  toutesLesAnnonces = annonces || [];

  if (toutesLesAnnonces.length === 0) {
    container.innerHTML = "<p>Aucune annonce en vente pour l'instant.</p>";
    return;
  }

  // Récupère le nombre de favoris de chaque stylo (visible par tout le monde)
  const comptes = await Promise.all(toutesLesAnnonces.map(a => compterFavorisStylo(a.stylo_id)));
  toutesLesAnnonces.forEach((a, i) => { a.nbFavoris = comptes[i]; });

  const monId = monIdUtilisateurAnnonces;

  function carteAnnonceHtml(annonce) {
    const urlPhoto = annonce.stylos.photos && annonce.stylos.photos.length > 0
      ? obtenirUrlPhoto(annonce.stylos)
      : null;
    const estFavori = idsFavorisAnnonces.has(annonce.stylo_id);
const estMoi = annonce.vendeur_id === monId;
    const peutModifier = estMoi || monEstAdmin;    return `
      <div class="carte-stylo carte-cliquable" onclick="ouvrirDetailAnnonce('${annonce.id}')">
        ${urlPhoto
          ? `<img src="${urlPhoto}" alt="${annonce.stylos.nom}" class="photo-carte">`
          : `<div class="photo-carte photo-manquante">Pas de photo</div>`
        }
        <div class="infos-carte">
${monIdUtilisateurAnnonces ? `<button class="bouton-favori-texte ${estFavori ? 'favori-actif' : ''}" onclick="event.stopPropagation(); toggleFavoriAnnonce('${annonce.stylo_id}')">${estFavori ? 'Favori' : '+ Favori'}</button>` : ''}<h3>${annonce.stylos.nom}</h3>
          ${badgeRareteHtml(annonce.stylos.rarete)}
          <p class="prix">${annonce.prix} €</p>
          <div class="stats-annonce">
  <span>${annonce.nbFavoris} favori${annonce.nbFavoris > 1 ? "s" : ""}</span>
  ${estMoi ? `<span>${annonce.vues} vue${annonce.vues > 1 ? "s" : ""}</span>` : ""}
</div>
          ${peutModifier
            ? `<button class="bouton-vendre" onclick="event.stopPropagation(); modifierAnnonce('${annonce.id}', ${annonce.prix})">Modifier le prix</button>`
            : `<button class="bouton-vendre" onclick="event.stopPropagation(); contacterVendeur('${annonce.id}', '${annonce.vendeur_id}')">Contacter le vendeur</button>`
          }
        </div>
      </div>
    `;
  }

  const sectionFavoris = document.getElementById("section-favoris");
  const listeFavoris = document.getElementById("liste-favoris");
  const favorisAffiches = toutesLesAnnonces.filter(a => idsFavorisAnnonces.has(a.stylo_id));
  const resteAffiches = toutesLesAnnonces.filter(a => !idsFavorisAnnonces.has(a.stylo_id));

  if (favorisAffiches.length > 0) {
    sectionFavoris.style.display = "block";
    listeFavoris.innerHTML = favorisAffiches.map(carteAnnonceHtml).join("");
  } else {
    sectionFavoris.style.display = "none";
  }
  container.innerHTML = resteAffiches.map(carteAnnonceHtml).join("");

  window.toggleFavoriAnnonce = async function (styloId) {
    if (idsFavorisAnnonces.has(styloId)) {
      await supabaseClient.from("favoris").delete().eq("utilisateur_id", monIdUtilisateurAnnonces).eq("stylo_id", styloId);
      idsFavorisAnnonces.delete(styloId);
    } else {
      await supabaseClient.from("favoris").insert({ utilisateur_id: monIdUtilisateurAnnonces, stylo_id: styloId });
      idsFavorisAnnonces.add(styloId);
    }
    await chargerAnnonces();
  };
}

chargerAnnonces();

async function modifierAnnonce(annonceId, prixActuel) {
  const nouveauPrix = prompt("Nouveau prix (€) :", prixActuel);
  if (!nouveauPrix) return;
  const prixNombre = parseFloat(nouveauPrix);
  if (isNaN(prixNombre) || prixNombre <= 0) {
    alert("Prix invalide.");
    return;
  }
  const nouveauStatut = prixNombre >= 20 ? "en_attente" : "active";
  const { error } = await supabaseClient
    .from("annonces")
    .update({ prix: prixNombre, statut: nouveauStatut })
    .eq("id", annonceId);
  if (error) {
    alert("Erreur : " + error.message);
    return;
  }
  window.location.reload();
}

async function ouvrirDetailAnnonce(annonceId) {
  const annonce = toutesLesAnnonces.find(a => a.id === annonceId);
  if (!annonce) return;

  const ancienneModale = document.getElementById("modale-annonce");
  if (ancienneModale) ancienneModale.remove();

  // On ne compte pas les vues du vendeur sur sa propre annonce
  if (annonce.vendeur_id !== monIdUtilisateurAnnonces) {
    await enregistrerVueAnnonce(annonceId);
    annonce.vues = (annonce.vues || 0) + 1;
  }

  const urlPhoto = obtenirUrlPhoto(annonce.stylos);

  const overlay = document.createElement("div");
  overlay.id = "modale-annonce";
  overlay.className = "modale-fond";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const estMoi = annonce.vendeur_id === monIdUtilisateurAnnonces;

  overlay.innerHTML = `
    <div class="modale-annonce-boite">
      <div class="bandeau-4c"><span></span><span></span><span></span><span></span></div>
      <button class="modale-fermer" onclick="document.getElementById('modale-annonce').remove()">×</button>
      <h2>${annonce.stylos.nom}</h2>
      <div class="modale-detail-grid">
        <div>
          ${urlPhoto
            ? `<img src="${urlPhoto}" alt="${annonce.stylos.nom}" class="modale-detail-photo">`
            : `<div class="photo-carte photo-manquante modale-detail-photo">Pas de photo</div>`
          }
          <p style="margin-top:0.8rem;">${badgeRareteHtml(annonce.stylos.rarete)}</p>
          <p class="prix">${annonce.prix} €</p>
          <div class="stats-annonce">
            <span>${annonce.nbFavoris} favori${annonce.nbFavoris > 1 ? "s" : ""}</span>
            ${estMoi ? `<span>${annonce.vues} vue${annonce.vues > 1 ? "s" : ""}</span>` : ""}
          </div>
          <p>${annonce.stylos.lieu_ou_entreprise || ""}${annonce.stylos.ville ? " — " + annonce.stylos.ville : ""}${annonce.stylos.pays ? " (" + annonce.stylos.pays + ")" : ""}</p>
          ${annonce.stylos.description ? `<p>${annonce.stylos.description}</p>` : ""}
          ${annonce.description ? `<p><em>${annonce.description}</em></p>` : ""}
          <a href="fiche-stylo.html?stylo=${annonce.stylo_id}" style="font-size:0.8rem; color: var(--bic-bleu);">Voir toutes les annonces de ce stylo →</a>
        </div>
        <div class="mini-profil-vendeur" id="mini-profil-vendeur">
          <p>Chargement du profil...</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const zoneVendeur = document.getElementById("mini-profil-vendeur");
  const { data: evaluations } = await supabaseClient
    .from("evaluations")
    .select("note")
    .eq("evalue_id", annonce.vendeur_id);

  const nbEvaluations = evaluations ? evaluations.length : 0;
  const moyenne = nbEvaluations > 0
    ? (evaluations.reduce((somme, e) => somme + e.note, 0) / nbEvaluations).toFixed(1)
    : null;

  zoneVendeur.innerHTML = `
    <h4>${annonce.vendeur ? annonce.vendeur.pseudo : "Vendeur"}</h4>
    <p>${moyenne ? `★ ${moyenne} / 5 (${nbEvaluations} avis)` : "Pas encore d'évaluation"}</p>
    <a class="voir-profil" href="profil.html?id=${annonce.vendeur_id}">Voir le profil complet →</a>
  `;
}