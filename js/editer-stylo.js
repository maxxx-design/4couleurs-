// editer-stylo.js — popup d'édition complète d'un stylo (créateur ou admin uniquement)
// Réutilise RARETES_AJOUT, REGIONS_FRANCE, estFrance() déjà définis dans ajouter.js

const SOUS_CATEGORIES_EDIT = {
  touristique: ["Ville", "Monument", "Institution", "Région/Département/Pays"],
  publicitaire: ["Entreprise", "Association", "Institution", "Sport", "Événement"]
};

async function ouvrirEditionStylo(styloId) {
  const session = await verifierConnexion();
  if (!session) { construireModaleAuth(); return; }

  const { data: stylo, error: erreurStylo } = await supabaseClient
    .from("stylos")
    .select("*, stylo_categories(categories(nom)), stylo_sous_categories(sous_categories(nom)), photos(id, storage_path, est_principale)")
    .eq("id", styloId)
    .single();
  if (erreurStylo || !stylo) { alert("Stylo introuvable."); return; }

  const { data: profilConnecte } = await supabaseClient.from("profils").select("est_admin").eq("id", session.user.id).maybeSingle();
  const estAdmin = profilConnecte ? profilConnecte.est_admin : false;
  const estProprietaire = stylo.cree_par === session.user.id;

  if (!estProprietaire && !estAdmin) {
    alert("Tu n'as pas la permission de modifier ce stylo.");
    return;
  }

  const { data: annonceExistante } = await supabaseClient
    .from("annonces")
    .select("id, prix, description")
    .eq("stylo_id", styloId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  construireModaleEditionStylo(stylo, annonceExistante || null, session.user.id);
}

let idsPhotosASupprimerEdit = [];
let nouveauFichierPrincipalEdit = null;
let nouveauxFichiersSecondairesEdit = [];
let categoriesChoisiesEdit = new Set();
let sousCategorieChoisieEdit = "";

async function construireModaleEditionStylo(stylo, annonce, monId) {
  idsPhotosASupprimerEdit = [];
  nouveauFichierPrincipalEdit = null;
  nouveauxFichiersSecondairesEdit = [];
  categoriesChoisiesEdit = new Set((stylo.stylo_categories || []).map(sc => sc.categories.nom));
  sousCategorieChoisieEdit = (stylo.stylo_sous_categories || []).map(ssc => ssc.sous_categories.nom)[0] || "";

  const ancienne = document.getElementById("modale-edition-stylo");
  if (ancienne) ancienne.remove();

  const coordonneesActuelles = (stylo.latitude && stylo.longitude) ? `${stylo.latitude}, ${stylo.longitude}` : "";
  const photoPrincipale = (stylo.photos || []).find(p => p.est_principale) || null;
  const photosSecondaires = (stylo.photos || []).filter(p => !p.est_principale);
  const urlPrincipaleActuelle = photoPrincipale
    ? supabaseClient.storage.from("stylos-photos").getPublicUrl(photoPrincipale.storage_path).data.publicUrl
    : null;

  const overlay = document.createElement("div");
  overlay.id = "modale-edition-stylo";
  overlay.className = "modale-fond";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.innerHTML = `
    <div class="modale-annonce-boite">
      <div class="bandeau-4c"><span></span><span></span><span></span><span></span></div>
      <button class="modale-fermer" onclick="document.getElementById('modale-edition-stylo').remove()">×</button>
      <h2>Modifier « ${stylo.nom} »</h2>
      <form id="form-edition-stylo" class="formulaire" style="margin:0 1.5rem 1.5rem; max-width:none;">
        <label>Nom
          <input type="text" id="edit-nom" value="${stylo.nom || ""}" required>
        </label>

        <label>État du stylo
          <select id="edit-etat">
            <option value="Neuf">Neuf</option>
            <option value="Très bon état">Très bon état</option>
            <option value="Bon état">Bon état</option>
            <option value="État moyen">État moyen</option>
            <option value="Abîmé">Abîmé</option>
          </select>
        </label>

        <label>Rareté</label>
        <div class="selecteur-raretes" id="edit-selecteur-raretes">
          ${RARETES_AJOUT.map(r => `<div class="option-rarete ${r === stylo.rarete ? 'selectionnee' : ''}" data-valeur="${r}">${LABELS_RARETE[r]}</div>`).join("")}
        </div>

        <label>Photo principale actuelle</label>
        <div class="apercu-photos" id="edit-apercu-principale-actuelle">
          ${urlPrincipaleActuelle ? `<img src="${urlPrincipaleActuelle}" class="apercu-photo">` : `<p class="aide-champ">Aucune photo principale.</p>`}
        </div>
        <label>Remplacer la photo principale (optionnel)
          <input type="file" id="edit-photo-principale" accept="image/*">
        </label>
        <div class="apercu-photos" id="edit-apercu-principale-nouvelle"></div>

        <label>Photos secondaires actuelles</label>
        <div class="apercu-photos" id="edit-apercu-secondaires-actuelles">
          ${photosSecondaires.length === 0 ? `<p class="aide-champ">Aucune photo secondaire.</p>` : photosSecondaires.map(p => {
            const url = supabaseClient.storage.from("stylos-photos").getPublicUrl(p.storage_path).data.publicUrl;
            return `<div class="apercu-photo-conteneur" data-id-photo="${p.id}">
              <img src="${url}" class="apercu-photo">
              <button type="button" class="apercu-photo-supprimer" onclick="marquerPhotoSecondairePourSuppression(this, '${p.id}')">×</button>
            </div>`;
          }).join("")}
        </div>
        <label>Ajouter des photos secondaires (optionnel)
          <input type="file" id="edit-photos-secondaires" accept="image/*" multiple>
        </label>
        <div class="apercu-photos" id="edit-apercu-secondaires-nouvelles"></div>

        <label>Type de stylo (les deux sont possibles ensemble)</label>
        <div class="selecteur-type" id="edit-selecteur-type">
          <div class="option-type ${categoriesChoisiesEdit.has('publicitaire') ? 'selectionnee' : ''}" data-valeur="publicitaire">Publicitaire</div>
          <div class="option-type ${categoriesChoisiesEdit.has('touristique') ? 'selectionnee' : ''}" data-valeur="touristique">Touristique</div>
        </div>

        <div id="edit-zone-sous-categories" style="display:${categoriesChoisiesEdit.size > 0 ? 'block' : 'none'};">
          <label>Sous-catégorie</label>
          <div class="selecteur-chips" id="edit-selecteur-chips"></div>
        </div>

        <div id="edit-zone-publicitaire" class="bloc-conditionnel" style="display:${categoriesChoisiesEdit.has('publicitaire') ? 'flex' : 'none'};">
          <label>Entreprise représentée
            <input type="text" id="edit-entreprise" value="${stylo.entreprise_representee || ""}">
          </label>
          <label>Type d'activité
            <input type="text" id="edit-type-activite" value="${stylo.type_activite || ""}">
          </label>
        </div>

        <div id="edit-zone-touristique" class="bloc-conditionnel" style="display:${categoriesChoisiesEdit.has('touristique') ? 'flex' : 'none'};">
          <label>Lieu représenté
            <input type="text" id="edit-lieu-touristique" value="${stylo.lieu_ou_entreprise || ""}">
          </label>
          <label>Ville
            <input type="text" id="edit-ville" value="${stylo.ville || ""}">
          </label>
          <label>Pays
            <input type="text" id="edit-pays" value="${stylo.pays || "France"}" list="edit-liste-pays">
            <datalist id="edit-liste-pays"></datalist>
          </label>
          <div class="zone-region-toggle">
            <label id="edit-zone-region-france">Région
              <select id="edit-region-select">
                <option value="">Choisir une région</option>
                ${REGIONS_FRANCE.map(r => `<option value="${r}" ${r === stylo.region ? "selected" : ""}>${r}</option>`).join("")}
              </select>
            </label>
            <label id="edit-zone-region-etrangere" style="display:none;">Région
              <input type="text" value="Région étrangère" readonly>
            </label>
          </div>
          <label>Coordonnées GPS (format : lat, lng)
            <input type="text" id="edit-coordonnees" value="${coordonneesActuelles}" placeholder="43.206261, 2.364185">
          </label>
        </div>

        <label>Description générale
          <textarea id="edit-description-generale">${stylo.description || ""}</textarea>
        </label>

        <fieldset>
          <legend>Annonce</legend>
          <label>Prix d'achat (€)
            <input type="number" step="0.01" id="edit-prix-achat" value="${stylo.prix_achat || ""}">
          </label>
          <label>Prix de vente (€)
            <input type="number" step="0.01" id="edit-prix-vente" value="${annonce ? annonce.prix : ""}">
          </label>
          <label>Description de l'annonce
            <textarea id="edit-description-annonce">${annonce ? (annonce.description || "") : ""}</textarea>
          </label>
        </fieldset>

        <button type="submit">Enregistrer les modifications</button>
        <p id="edit-message"></p>
      </form>
      <div style="margin: 0 1.5rem 1.5rem;">
        <button type="button" class="bouton-refuser" id="bouton-supprimer-stylo">Supprimer ce stylo</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("edit-etat").value = stylo.etat || "Bon état";

  const { data: pays } = await supabaseClient.from("pays_references").select("nom").order("nom");
  document.getElementById("edit-liste-pays").innerHTML = (pays || []).map(p => `<option value="${p.nom}">`).join("");

  function toggleZoneRegionEdit() {
    const valeur = document.getElementById("edit-pays").value;
    document.getElementById("edit-zone-region-france").style.display = estFrance(valeur) ? "block" : "none";
    document.getElementById("edit-zone-region-etrangere").style.display = estFrance(valeur) ? "none" : "block";
  }
  document.getElementById("edit-pays").addEventListener("input", toggleZoneRegionEdit);
  toggleZoneRegionEdit();

  function rafraichirChipsEdit() {
    const zone = document.getElementById("edit-zone-sous-categories");
    const chips = document.getElementById("edit-selecteur-chips");
    const options = new Set();
    categoriesChoisiesEdit.forEach(cat => (SOUS_CATEGORIES_EDIT[cat] || []).forEach(s => options.add(s)));

    if (options.size === 0) { zone.style.display = "none"; sousCategorieChoisieEdit = ""; return; }
    zone.style.display = "block";
    chips.innerHTML = Array.from(options).map(nom =>
      `<div class="chip-sous-categorie ${nom === sousCategorieChoisieEdit ? 'selectionnee' : ''}" data-valeur="${nom}">${nom}</div>`
    ).join("");
    chips.querySelectorAll(".chip-sous-categorie").forEach(chip => {
      chip.addEventListener("click", () => {
        chips.querySelectorAll(".chip-sous-categorie").forEach(c => c.classList.remove("selectionnee"));
        chip.classList.add("selectionnee");
        sousCategorieChoisieEdit = chip.dataset.valeur;
      });
    });
  }
  rafraichirChipsEdit();

  overlay.querySelectorAll(".option-type").forEach(el => {
    el.addEventListener("click", () => {
      const valeur = el.dataset.valeur;
      if (categoriesChoisiesEdit.has(valeur)) {
        categoriesChoisiesEdit.delete(valeur);
        el.classList.remove("selectionnee");
      } else {
        categoriesChoisiesEdit.add(valeur);
        el.classList.add("selectionnee");
      }
      document.getElementById("edit-zone-publicitaire").style.display = categoriesChoisiesEdit.has("publicitaire") ? "flex" : "none";
      document.getElementById("edit-zone-touristique").style.display = categoriesChoisiesEdit.has("touristique") ? "flex" : "none";
      rafraichirChipsEdit();
    });
  });

  let rareteChoisieEdit = stylo.rarete;
  overlay.querySelectorAll(".option-rarete").forEach(el => {
    el.addEventListener("click", () => {
      overlay.querySelectorAll(".option-rarete").forEach(o => o.classList.remove("selectionnee"));
      el.classList.add("selectionnee");
      rareteChoisieEdit = el.dataset.valeur;
    });
  });

  document.getElementById("edit-photo-principale").addEventListener("change", (e) => {
    nouveauFichierPrincipalEdit = e.target.files[0] || null;
    document.getElementById("edit-apercu-principale-nouvelle").innerHTML = nouveauFichierPrincipalEdit
      ? `<img src="${URL.createObjectURL(nouveauFichierPrincipalEdit)}" class="apercu-photo">` : "";
  });

  document.getElementById("edit-photos-secondaires").addEventListener("change", (e) => {
    nouveauxFichiersSecondairesEdit = Array.from(e.target.files);
    document.getElementById("edit-apercu-secondaires-nouvelles").innerHTML = nouveauxFichiersSecondairesEdit
      .map(f => `<img src="${URL.createObjectURL(f)}" class="apercu-photo">`).join("");
  });

  document.getElementById("form-edition-stylo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = document.getElementById("edit-message");

    if (categoriesChoisiesEdit.size === 0) {
      message.textContent = "Choisis Touristique, Publicitaire, ou les deux.";
      message.style.color = "red";
      return;
    }

    message.textContent = "Enregistrement...";
    message.style.color = "black";

    let lieuOuEntreprise = null, ville = null, region = null, paysValeur = "France", latitude = null, longitude = null;
    let entrepriseRepresentee = null, typeActivite = null;

    if (categoriesChoisiesEdit.has("publicitaire")) {
      entrepriseRepresentee = document.getElementById("edit-entreprise").value || null;
      typeActivite = document.getElementById("edit-type-activite").value || null;
    }

    if (categoriesChoisiesEdit.has("touristique")) {
      lieuOuEntreprise = document.getElementById("edit-lieu-touristique").value;
      ville = document.getElementById("edit-ville").value.trim() || null;
      paysValeur = document.getElementById("edit-pays").value.trim() || "France";
      const coordonneesTexte = document.getElementById("edit-coordonnees").value.trim();
      region = estFrance(paysValeur) ? document.getElementById("edit-region-select").value : "Région étrangère";
      if (coordonneesTexte.includes(",")) {
        const parties = coordonneesTexte.split(",");
        latitude = parseFloat(parties[0].trim());
        longitude = parseFloat(parties[1].trim());
        if (isNaN(latitude) || isNaN(longitude)) { latitude = null; longitude = null; }
      }
      await supabaseClient.from("pays_references").upsert({ nom: paysValeur }, { onConflict: "nom", ignoreDuplicates: true });
    }

    const { error: erreurMajStylo } = await supabaseClient.from("stylos").update({
      nom: document.getElementById("edit-nom").value,
      etat: document.getElementById("edit-etat").value,
      rarete: rareteChoisieEdit,
      lieu_ou_entreprise: lieuOuEntreprise,
      entreprise_representee: entrepriseRepresentee,
      type_activite: typeActivite,
      ville: ville,
      region: region,
      pays: paysValeur,
      latitude: latitude,
      longitude: longitude,
      description: document.getElementById("edit-description-generale").value || null,
      prix_achat: document.getElementById("edit-prix-achat").value || null
    }).eq("id", stylo.id);

    if (erreurMajStylo) {
      message.textContent = "Erreur : " + erreurMajStylo.message;
      message.style.color = "red";
      return;
    }

    await supabaseClient.from("stylo_categories").delete().eq("stylo_id", stylo.id);
    if (categoriesChoisiesEdit.size > 0) {
      const { data: categories } = await supabaseClient.from("categories").select("id, nom").in("nom", Array.from(categoriesChoisiesEdit));
      if (categories && categories.length > 0) {
        await supabaseClient.from("stylo_categories").insert(categories.map(c => ({ stylo_id: stylo.id, categorie_id: c.id })));
      }
    }

    await supabaseClient.from("stylo_sous_categories").delete().eq("stylo_id", stylo.id);
    if (sousCategorieChoisieEdit) {
      const { data: sousCategorie } = await supabaseClient.from("sous_categories").select("id").eq("nom", sousCategorieChoisieEdit).single();
      if (sousCategorie) await supabaseClient.from("stylo_sous_categories").insert({ stylo_id: stylo.id, sous_categorie_id: sousCategorie.id });
    }

    for (const photoId of idsPhotosASupprimerEdit) {
      const photoAEffacer = photosSecondaires.find(p => p.id === photoId);
      if (photoAEffacer) {
        await supabaseClient.storage.from("stylos-photos").remove([photoAEffacer.storage_path]);
        await supabaseClient.from("photos").delete().eq("id", photoId);
      }
    }

    if (nouveauFichierPrincipalEdit) {
      if (photoPrincipale) {
        await supabaseClient.storage.from("stylos-photos").remove([photoPrincipale.storage_path]);
        await supabaseClient.from("photos").delete().eq("id", photoPrincipale.id);
      }
      const chemin = `${stylo.id}/principale-${Date.now()}-${nouveauFichierPrincipalEdit.name}`;
      const { error: erreurUpload } = await supabaseClient.storage.from("stylos-photos").upload(chemin, nouveauFichierPrincipalEdit);
      if (!erreurUpload) {
        await supabaseClient.from("photos").insert({ stylo_id: stylo.id, storage_path: chemin, credit_utilisateur: monId, est_principale: true, ordre: 0 });
      }
    }

    for (let i = 0; i < nouveauxFichiersSecondairesEdit.length; i++) {
      const fichier = nouveauxFichiersSecondairesEdit[i];
      const chemin = `${stylo.id}/secondaire-${Date.now()}-${i}-${fichier.name}`;
      const { error: erreurUpload } = await supabaseClient.storage.from("stylos-photos").upload(chemin, fichier);
      if (!erreurUpload) {
        await supabaseClient.from("photos").insert({ stylo_id: stylo.id, storage_path: chemin, credit_utilisateur: monId, est_principale: false, ordre: i + 1 });
      }
    }

    const prixVente = document.getElementById("edit-prix-vente").value;
    if (annonce && prixVente) {
      await supabaseClient.from("annonces").update({
        prix: parseFloat(prixVente),
        description: document.getElementById("edit-description-annonce").value || null
      }).eq("id", annonce.id);
    } else if (!annonce && prixVente) {
      const prixNombre = parseFloat(prixVente);
      await supabaseClient.from("annonces").insert({
        stylo_id: stylo.id,
        vendeur_id: stylo.cree_par,
        prix: prixNombre,
        description: document.getElementById("edit-description-annonce").value || null,
        statut: prixNombre >= 20 ? "en_attente" : "active"
      });
    } else if (annonce && !prixVente) {
      await supabaseClient.from("annonces").delete().eq("id", annonce.id);
    }

    if (monId !== stylo.cree_par) {
      await envoyerMessageSysteme(stylo.cree_par, `Ta fiche « ${stylo.nom} » a été modifiée par un modérateur.`, { styloId: stylo.id });
    }

    message.textContent = "Modifications enregistrées !";
    message.style.color = "green";
    setTimeout(() => {
      overlay.remove();
      if (typeof chargerAnnonces === "function") chargerAnnonces();
      if (window.location.pathname.includes("fiche-stylo.html")) window.location.reload();
    }, 700);
  });

  document.getElementById("bouton-supprimer-stylo").addEventListener("click", async () => {
    const confirmation = confirm(`Supprimer définitivement « ${stylo.nom} » ? Cette action efface aussi ses photos, son annonce et ses favoris, et est irréversible.`);
    if (!confirmation) return;

    const message = document.getElementById("edit-message");
    message.textContent = "Suppression en cours...";
    message.style.color = "black";

    if (monId !== stylo.cree_par) {
      await envoyerMessageSysteme(stylo.cree_par, `Ta fiche « ${stylo.nom} » a été supprimée par un modérateur.`, {});
    }

    const erreur = await supprimerStyloDefinitivement(stylo.id);
    if (erreur) {
      message.textContent = "Erreur lors de la suppression : " + erreur.message;
      message.style.color = "red";
      return;
    }

    overlay.remove();
    if (typeof chargerAnnonces === "function") chargerAnnonces();
    else window.location.href = "index.html";
  });
}

function marquerPhotoSecondairePourSuppression(bouton, photoId) {
  idsPhotosASupprimerEdit.push(photoId);
  bouton.closest(".apercu-photo-conteneur").remove();
}