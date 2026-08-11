(async function initProfil() {
  const params = new URLSearchParams(window.location.search);
  const profilId = params.get("id");
  const container = document.getElementById("contenu-profil");
  const titre = document.getElementById("titre-profil");

  if (!profilId) {
    container.innerHTML = "<p>Profil introuvable.</p>";
    return;
  }

  const { data: profil, error } = await supabaseClient
    .from("profils")
    .select("pseudo, created_at")
    .eq("id", profilId)
    .single();

  if (error || !profil) {
    container.innerHTML = "<p>Profil introuvable.</p>";
    return;
  }

  titre.textContent = profil.pseudo;

  const { data: evaluations } = await supabaseClient
    .from("evaluations")
    .select("note, commentaire, created_at, evaluateur:evaluateur_id(pseudo)")
    .eq("evalue_id", profilId)
    .order("created_at", { ascending: false });

  const nbEvaluations = evaluations ? evaluations.length : 0;
  const moyenne = nbEvaluations > 0
    ? (evaluations.reduce((somme, e) => somme + e.note, 0) / nbEvaluations).toFixed(1)
    : null;

  container.innerHTML = `
    <p>Membre depuis ${new Date(profil.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
    <p style="font-size: 1.3rem;">
      ${moyenne ? `★ ${moyenne} / 5` : "Pas encore d'évaluation"}
      ${nbEvaluations > 0 ? `<span style="color:#6B6558; font-size: 0.9rem;"> (${nbEvaluations} avis)</span>` : ""}
    </p>
    ${nbEvaluations > 0 ? `<button class="bouton-vendre" id="bouton-toggle-commentaires">Voir les commentaires</button>` : ""}
    <div id="liste-commentaires" style="display:none; margin-top: 1rem;"></div>
  `;

  if (nbEvaluations > 0) {
    document.getElementById("bouton-toggle-commentaires").addEventListener("click", () => {
      const liste = document.getElementById("liste-commentaires");
      const estVisible = liste.style.display === "block";
      liste.style.display = estVisible ? "none" : "block";
      if (!estVisible) {
        liste.innerHTML = evaluations.map(e => `
          <div class="carte-stylo" style="margin-bottom: 0.6rem;">
            <p><strong>${e.evaluateur.pseudo}</strong> — ★ ${e.note}/5</p>
            ${e.commentaire ? `<p>${e.commentaire}</p>` : ""}
          </div>
        `).join("");
      }
    });
  }

  // ---- Stylos que cette personne vend actuellement (public) ----
  const containerVentes = document.getElementById("ventes-profil");
  const { data: enVente } = await supabaseClient
    .from("annonces")
    .select("id, prix, stylo_id, stylos(nom, rarete, photos(storage_path, est_principale))")
    .eq("vendeur_id", profilId)
    .eq("statut", "active");

  if (enVente && enVente.length > 0) {
    containerVentes.innerHTML = `
      <h2>En vente (${enVente.length})</h2>
      <div class="grille-stylos">
        ${enVente.map(a => {
          const urlPhoto = obtenirUrlPhoto(a.stylos);
          return `
            <a href="fiche-stylo.html?stylo=${a.stylo_id}" class="lien-photo-carte" style="text-decoration:none; color:inherit;">
              <div class="carte-stylo">
                ${urlPhoto ? `<img src="${urlPhoto}" alt="${a.stylos.nom}" class="photo-carte">` : `<div class="photo-carte photo-manquante">Pas de photo</div>`}
                <div class="infos-carte">
                  <h3>${a.stylos.nom}</h3>
                  ${badgeRareteHtml(a.stylos.rarete)}
                  <p class="prix">${a.prix} €</p>
                </div>
              </div>
            </a>
          `;
        }).join("")}
      </div>
    `;
  }

  // ---- Favoris (visibles uniquement si c'est ton propre profil) ----
  const containerFavoris = document.getElementById("favoris-profil");
  const session = await verifierConnexion();
  if (session && session.user.id === profilId) {
    const { data: mesFavoris } = await supabaseClient
      .from("favoris")
      .select("stylos(id, nom, rarete, photos(storage_path, est_principale))")
      .eq("utilisateur_id", profilId);

    if (mesFavoris && mesFavoris.length > 0) {
      containerFavoris.innerHTML = `
        <h2>Mes favoris (${mesFavoris.length})</h2>
        <div class="grille-stylos">
          ${mesFavoris.map(f => {
            const stylo = f.stylos;
            const urlPhoto = obtenirUrlPhoto(stylo);
            return `
              <a href="fiche-stylo.html?stylo=${stylo.id}" class="lien-photo-carte" style="text-decoration:none; color:inherit;">
                <div class="carte-stylo">
                  ${urlPhoto ? `<img src="${urlPhoto}" alt="${stylo.nom}" class="photo-carte">` : `<div class="photo-carte photo-manquante">Pas de photo</div>`}
                  <div class="infos-carte">
                    <h3>${stylo.nom}</h3>
                    ${badgeRareteHtml(stylo.rarete)}
                  </div>
                </div>
              </a>
            `;
          }).join("")}
        </div>
      `;
    }
  }

  // ---- Collection possédée (inchangé) ----
  const containerCollection = document.getElementById("collection-profil");
  const { data: possessions } = await supabaseClient
    .from("possessions")
    .select("stylos(id, nom, rarete, photos(storage_path, est_principale))")
    .eq("utilisateur_id", profilId);

  if (possessions && possessions.length > 0) {
    containerCollection.innerHTML = `
      <h2>Collection de ${profil.pseudo} (${possessions.length})</h2>
      <div class="grille-stylos">
        ${possessions.map(p => {
          const stylo = p.stylos;
          const urlPhoto = obtenirUrlPhoto(stylo);
          return `
            <a href="vendre.html?stylo=${stylo.id}" class="lien-photo-carte" style="text-decoration:none; color:inherit;">
              <div class="carte-stylo">
                ${urlPhoto ? `<img src="${urlPhoto}" alt="${stylo.nom}" class="photo-carte">` : `<div class="photo-carte photo-manquante">Pas de photo</div>`}
                <div class="infos-carte">
                  <h3>${stylo.nom}</h3>
                  ${badgeRareteHtml(stylo.rarete)}
                </div>
              </div>
            </a>
          `;
        }).join("")}
      </div>
    `;
  }
})();