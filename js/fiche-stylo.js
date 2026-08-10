(async function initFicheStylo() {
  const params = new URLSearchParams(window.location.search);
  const styloId = params.get("stylo");
  const infoStylo = document.getElementById("info-stylo");
  const listeAnnonces = document.getElementById("liste-annonces-stylo");

  if (!styloId) {
    infoStylo.innerHTML = "<p>Aucun stylo sélectionné.</p>";
    return;
  }

  const { data: stylo, error: erreurStylo } = await supabaseClient
    .from("stylos")
    .select("id, nom, lieu_ou_entreprise, ville, pays, rarete, description, photos(storage_path, est_principale)")
    .eq("id", styloId)
    .single();

  if (erreurStylo || !stylo) {
    infoStylo.innerHTML = "<p>Stylo introuvable.</p>";
    return;
  }

  const urlPhotoPrincipale = obtenirUrlPhoto(stylo);
  const photosSecondaires = (stylo.photos || []).filter(p => !p.est_principale);

  infoStylo.innerHTML = `
    <div class="carte-stylo" style="max-width:400px;">
      ${urlPhotoPrincipale ? `<img src="${urlPhotoPrincipale}" alt="${stylo.nom}" class="photo-carte" id="photo-fiche-principale">` : `<div class="photo-carte photo-manquante">Pas de photo</div>`}
      <div class="infos-carte">
        <h3><span class="repere-4c"><span></span><span></span><span></span><span></span></span>${stylo.nom}</h3>
        <p class="rarete">${stylo.rarete}</p>
        <p>${stylo.lieu_ou_entreprise || ""}${stylo.ville ? " — " + stylo.ville : ""}${stylo.pays ? " (" + stylo.pays + ")" : ""}</p>
        ${stylo.description ? `<p>${stylo.description}</p>` : ""}
        ${photosSecondaires.length > 0 ? `
          <div class="galerie-secondaire">
            ${photosSecondaires.map(p => {
              const url = supabaseClient.storage.from("stylos-photos").getPublicUrl(p.storage_path).data.publicUrl;
              return `<img src="${url}" onclick="document.getElementById('photo-fiche-principale').src='${url}'">`;
            }).join("")}
          </div>
        ` : ""}
        <a href="vendre.html?stylo=${stylo.id}" class="bouton-vendre">Vendre ce stylo aussi</a>
      </div>
    </div>
  `;

  const session = await verifierConnexion();
  const monId = session ? session.user.id : null;

  const { data: annonces, error: erreurAnnonces } = await supabaseClient
    .from("annonces")
    .select("id, prix, description, vendeur_id, vendeur:vendeur_id(pseudo)")
    .eq("stylo_id", styloId)
    .eq("statut", "active")
    .order("prix", { ascending: true });

  if (erreurAnnonces) {
    listeAnnonces.innerHTML = "<p>Erreur : " + erreurAnnonces.message + "</p>";
    return;
  }

  if (!annonces || annonces.length === 0) {
    listeAnnonces.innerHTML = "<p>Aucune annonce active pour ce stylo pour l'instant.</p>";
    return;
  }

  listeAnnonces.innerHTML = annonces.map(annonce => `
    <div class="carte-stylo">
      <div class="infos-carte">
        <p class="prix">${annonce.prix} €</p>
        <p><a href="profil.html?id=${annonce.vendeur_id}">${annonce.vendeur ? annonce.vendeur.pseudo : "Vendeur"}</a></p>
        ${annonce.description ? `<p style="font-size:0.85rem;">${annonce.description}</p>` : ""}
        ${annonce.vendeur_id === monId
          ? `<span class="badge-vente">C'est ton annonce</span>`
          : `<button class="bouton-vendre" onclick="contacterVendeur('${annonce.id}', '${annonce.vendeur_id}')">Contacter le vendeur</button>`
        }
      </div>
    </div>
  `).join("");
})();