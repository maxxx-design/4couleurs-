// ajouter.js — popup "Ajouter un stylo" : Touristique et/ou Publicitaire (les deux possibles ensemble)

const RARETES_AJOUT = ["commun", "peu_commun", "rare", "tres_rare", "exceptionnel"];

const REGIONS_FRANCE = [
  "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne", "Centre-Val de Loire",
  "Corse", "Grand Est", "Hauts-de-France", "Île-de-France", "Normandie",
  "Nouvelle-Aquitaine", "Occitanie", "Pays de la Loire", "Provence-Alpes-Côte d'Azur",
  "Guadeloupe", "Martinique", "Guyane", "La Réunion", "Mayotte"
];

let categoriesChoisiesAjout = new Set();
let rareteChoisieAjout = "commun";
let annonceActiveAjout = false;
let fichierPrincipalAjout = null;
let fichiersSecondairesAjout = [];

function estFrance(valeur) {
  return (valeur || "").trim().toLowerCase() === "france";
}

async function ouvrirModaleAjout() {
  const session = await verifierConnexion();
  if (!session) {
    construireModaleAuth();
    return;
  }

  categoriesChoisiesAjout = new Set();
  rareteChoisieAjout = "commun";
  annonceActiveAjout = false;
  fichierPrincipalAjout = null;
  fichiersSecondairesAjout = [];

  const ancienne = document.getElementById("modale-ajout");
  if (ancienne) ancienne.remove();

  const overlay = document.createElement("div");
  overlay.id = "modale-ajout";
  overlay.className = "modale-fond";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.innerHTML = `
    <div class="modale-annonce-boite">
      <div class="bandeau-4c"><span></span><span></span><span></span><span></span></div>
      <button class="modale-fermer" onclick="document.getElementById('modale-ajout').remove()">×</button>
      <h2>Ajouter un stylo</h2>
      <form id="form-ajout-popup" class="formulaire" style="margin: 0 1.5rem 1.5rem; max-width:none;">
        <label>Nom
          <input type="text" id="ajout-nom" required>
        </label>

        <label>État du stylo
          <select id="ajout-etat">
            <option value="Neuf">Neuf</option>
            <option value="Très bon état">Très bon état</option>
            <option value="Bon état" selected>Bon état</option>
            <option value="État moyen">État moyen</option>
            <option value="Abîmé">Abîmé</option>
          </select>
        </label>

        <label>Rareté</label>
        <div class="selecteur-raretes" id="selecteur-raretes">
          ${RARETES_AJOUT.map(r => `<div class="option-rarete ${r === 'commun' ? 'selectionnee' : ''}" data-valeur="${r}">${LABELS_RARETE[r]}</div>`).join("")}
        </div>

        <label>Photo principale
          <input type="file" id="ajout-photo-principale" accept="image/*">
        </label>
        <div class="apercu-photos" id="apercu-principale"></div>

        <label>Photos secondaires (nécessaire pour faire une annonce)
          <input type="file" id="ajout-photos-secondaires" accept="image/*" multiple>
        </label>
        <div class="apercu-photos" id="apercu-secondaires"></div>

        <label>Type de stylo (les deux sont possibles ensemble)</label>
        <div class="selecteur-type" id="selecteur-type">
          <div class="option-type" data-valeur="publicitaire">Publicitaire</div>
          <div class="option-type" data-valeur="touristique">Touristique</div>
        </div>

        <div id="zone-publicitaire" class="bloc-conditionnel" style="display:none;">
          <label>Entreprise représentée
            <input type="text" id="ajout-entreprise">
          </label>
          <label>Type d'activité
            <input type="text" id="ajout-type-activite" placeholder="Ex : Automobile, Restauration, Banque...">
          </label>
        </div>

        <div id="zone-touristique" class="bloc-conditionnel" style="display:none;">
          <label>Lieu représenté
            <input type="text" id="ajout-lieu-touristique">
          </label>
          <label>Ville
            <input type="text" id="ajout-ville">
          </label>
          <p class="aide-champ">Si tu renseignes la ville, le pays, la région et les coordonnées GPS deviennent obligatoires.</p>
          <label>Pays
            <input type="text" id="ajout-pays" value="France" list="liste-pays">
            <datalist id="liste-pays"></datalist>
          </label>
          <div class="zone-region-toggle">
            <label id="zone-region-france">Région
              <select id="ajout-region-select">
                <option value="">Choisir une région</option>
                ${REGIONS_FRANCE.map(r => `<option value="${r}">${r}</option>`).join("")}
              </select>
            </label>
            <label id="zone-region-etrangere" style="display:none;">Région
              <input type="text" value="Région étrangère" readonly>
            </label>
          </div>
          <label>Coordonnées GPS (format : lat, lng)
            <input type="text" id="ajout-coordonnees" placeholder="43.206261, 2.364185">
          </label>
        </div>

        <button type="button" class="bouton-toggle-annonce" id="bouton-toggle-annonce">+ Faire une annonce</button>
        <div id="zone-annonce" class="bloc-conditionnel" style="display:none;">
          <label>Prix d'achat (€)
            <input type="number" step="0.01" id="ajout-prix-achat">
          </label>
          <label>Prix de vente (€)
            <input type="number" step="0.01" id="ajout-prix-vente">
          </label>
          <label>Description
            <textarea id="ajout-description-annonce"></textarea>
          </label>
        </div>

        <button type="submit">Envoyer</button>
        <p id="ajout-message"></p>
      </form>
      <div id="ajout-succes" style="display:none;"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  await chargerListePaysAjout();

  overlay.querySelectorAll(".option-rarete").forEach(el => {
    el.addEventListener("click", () => {
      overlay.querySelectorAll(".option-rarete").forEach(o => o.classList.remove("selectionnee"));
      el.classList.add("selectionnee");
      rareteChoisieAjout = el.dataset.valeur;
    });
  });

  overlay.querySelectorAll(".option-type").forEach(el => {
    el.addEventListener("click", () => {
      const valeur = el.dataset.valeur;
      if (categoriesChoisiesAjout.has(valeur)) {
        categoriesChoisiesAjout.delete(valeur);
        el.classList.remove("selectionnee");
      } else {
        categoriesChoisiesAjout.add(valeur);
        el.classList.add("selectionnee");
      }
      document.getElementById("zone-publicitaire").style.display = categoriesChoisiesAjout.has("publicitaire") ? "flex" : "none";
      document.getElementById("zone-touristique").style.display = categoriesChoisiesAjout.has("touristique") ? "flex" : "none";
    });
  });

  document.getElementById("ajout-pays").addEventListener("input", toggleZoneRegion);

  document.getElementById("bouton-toggle-annonce").addEventListener("click", (e) => {
    annonceActiveAjout = !annonceActiveAjout;
    e.target.classList.toggle("actif", annonceActiveAjout);
    e.target.textContent = annonceActiveAjout ? "− Retirer l'annonce" : "+ Faire une annonce";
    document.getElementById("zone-annonce").style.display = annonceActiveAjout ? "flex" : "none";
  });

  document.getElementById("ajout-photo-principale").addEventListener("change", (e) => {
    fichierPrincipalAjout = e.target.files[0] || null;
    document.getElementById("apercu-principale").innerHTML = fichierPrincipalAjout
      ? `<img src="${URL.createObjectURL(fichierPrincipalAjout)}" class="apercu-photo">` : "";
  });

  document.getElementById("ajout-photos-secondaires").addEventListener("change", (e) => {
    fichiersSecondairesAjout = Array.from(e.target.files);
    document.getElementById("apercu-secondaires").innerHTML = fichiersSecondairesAjout
      .map(f => `<img src="${URL.createObjectURL(f)}" class="apercu-photo">`).join("");
  });

  document.getElementById("form-ajout-popup").addEventListener("submit", (e) => envoyerFormulaireAjout(e, session));
}

async function chargerListePaysAjout() {
  const { data } = await supabaseClient.from("pays_references").select("nom").order("nom");
  const datalist = document.getElementById("liste-pays");
  if (datalist) datalist.innerHTML = (data || []).map(p => `<option value="${p.nom}">`).join("");
}

function toggleZoneRegion() {
  const paysValeur = document.getElementById("ajout-pays").value;
  document.getElementById("zone-region-france").style.display = estFrance(paysValeur) ? "block" : "none";
  document.getElementById("zone-region-etrangere").style.display = estFrance(paysValeur) ? "none" : "block";
}

async function envoyerFormulaireAjout(e, session) {
  e.preventDefault();
  const message = document.getElementById("ajout-message");
  const utilisateurId = session.user.id;
  const nom = document.getElementById("ajout-nom").value;

  if (categoriesChoisiesAjout.size === 0) {
    message.textContent = "Choisis Touristique, Publicitaire, ou les deux.";
    message.style.color = "red";
    return;
  }

  let lieuOuEntreprise = null, ville = null, region = null, pays = "France", latitude = null, longitude = null;
  let entrepriseRepresentee = null, typeActivite = null;

  if (categoriesChoisiesAjout.has("publicitaire")) {
    entrepriseRepresentee = document.getElementById("ajout-entreprise").value || null;
    typeActivite = document.getElementById("ajout-type-activite").value || null;
  }

  if (categoriesChoisiesAjout.has("touristique")) {
    lieuOuEntreprise = document.getElementById("ajout-lieu-touristique").value;
    ville = document.getElementById("ajout-ville").value.trim() || null;
    pays = document.getElementById("ajout-pays").value.trim() || "France";
    const coordonneesTexte = document.getElementById("ajout-coordonnees").value.trim();
    region = estFrance(pays) ? document.getElementById("ajout-region-select").value : "Région étrangère";

    if (ville) {
      if (!pays || !coordonneesTexte || (estFrance(pays) && !region)) {
        message.textContent = "Ville renseignée : le pays, la région et les coordonnées GPS sont obligatoires.";
        message.style.color = "red";
        return;
      }
    }
    if (coordonneesTexte.includes(",")) {
      const parties = coordonneesTexte.split(",");
      latitude = parseFloat(parties[0].trim());
      longitude = parseFloat(parties[1].trim());
      if (isNaN(latitude) || isNaN(longitude)) { latitude = null; longitude = null; }
    }
    await supabaseClient.from("pays_references").upsert({ nom: pays }, { onConflict: "nom", ignoreDuplicates: true });
  }

  message.textContent = "Envoi en cours...";
  message.style.color = "black";

  const { data: stylosExistants } = await supabaseClient
    .from("stylos")
    .select("nom")
    .eq("statut_moderation", "valide");

  let raisonModeration = null;
  if (stylosExistants) {
    const proche = stylosExistants.find(s => correspondApproximativement(s.nom, nom) || correspondApproximativement(nom, s.nom));
    if (proche) raisonModeration = `Nom proche d'un stylo déjà catalogué : « ${proche.nom} »`;
  }
  const statutInitial = raisonModeration ? "en_attente" : "valide";

  const prixVente = document.getElementById("ajout-prix-vente").value || null;

  const { data: stylo, error: erreurStylo } = await supabaseClient
    .from("stylos")
    .insert({
      nom: nom,
      etat: document.getElementById("ajout-etat").value,
      lieu_ou_entreprise: lieuOuEntreprise,
      entreprise_representee: entrepriseRepresentee,
      type_activite: typeActivite,
      ville: ville,
      region: region,
      pays: pays,
      latitude: latitude,
      longitude: longitude,
      rarete: rareteChoisieAjout,
      prix_achat: document.getElementById("ajout-prix-achat").value || null,
      valeur_estimee: prixVente,
      cree_par: utilisateurId,
      statut_moderation: statutInitial,
      raison_moderation: raisonModeration
    })
    .select()
    .single();

  if (erreurStylo) {
    message.textContent = "Erreur : " + erreurStylo.message;
    message.style.color = "red";
    console.error(erreurStylo);
    return;
  }

  const { data: categories } = await supabaseClient
    .from("categories")
    .select("id, nom")
    .in("nom", Array.from(categoriesChoisiesAjout));
  if (categories && categories.length > 0) {
    const liaisons = categories.map(c => ({ stylo_id: stylo.id, categorie_id: c.id }));
    await supabaseClient.from("stylo_categories").insert(liaisons);
  }

  const photosAEnvoyer = [];
  if (fichierPrincipalAjout) photosAEnvoyer.push({ fichier: fichierPrincipalAjout, principale: true });
  fichiersSecondairesAjout.forEach(f => photosAEnvoyer.push({ fichier: f, principale: false }));

  for (let i = 0; i < photosAEnvoyer.length; i++) {
    const { fichier, principale } = photosAEnvoyer[i];
    const cheminFichier = `${stylo.id}/${i}-${fichier.name}`;
    const { error: erreurUpload } = await supabaseClient.storage.from("stylos-photos").upload(cheminFichier, fichier);
    if (!erreurUpload) {
      await supabaseClient.from("photos").insert({
        stylo_id: stylo.id,
        storage_path: cheminFichier,
        credit_utilisateur: utilisateurId,
        est_principale: principale,
        ordre: i
      });
    } else {
      console.error("Erreur upload photo :", erreurUpload);
    }
  }

  let annonceCreee = false;
  let annonceEnAttente = false;
  if (annonceActiveAjout && prixVente) {
    const prixNombre = parseFloat(prixVente);
    const statutAnnonce = prixNombre >= 20 ? "en_attente" : "active";
    const { error: erreurAnnonce } = await supabaseClient.from("annonces").insert({
      stylo_id: stylo.id,
      vendeur_id: utilisateurId,
      prix: prixNombre,
      description: document.getElementById("ajout-description-annonce").value || null,
      statut: statutAnnonce
    });
    if (!erreurAnnonce) {
      annonceCreee = true;
      annonceEnAttente = statutAnnonce === "en_attente";
    }
  }

  afficherSuccesAjout(statutInitial, raisonModeration, annonceCreee, annonceEnAttente);
}

function afficherSuccesAjout(statutInitial, raisonModeration, annonceCreee, annonceEnAttente) {
  if (statutInitial === "valide") {
    document.getElementById("modale-ajout").remove();
    if (typeof chargerCatalogue === "function") chargerCatalogue();
    return;
  }

  document.getElementById("form-ajout-popup").style.display = "none";
  const zoneSucces = document.getElementById("ajout-succes");
  zoneSucces.style.display = "block";
  zoneSucces.innerHTML = `
    <div class="ajout-succes">
      <div class="coche">✓</div>
      <h3>Stylo envoyé pour validation</h3>
      <p class="badge-raison">${raisonModeration}</p>
      <p style="color:#6B6558;">Il apparaîtra dans le catalogue une fois approuvé par un modérateur.</p>
      ${annonceCreee ? `<p style="color:#6B6558;">${annonceEnAttente ? "Ton annonce a été envoyée en modération (prix ≥ 20 €)." : "Ton annonce est déjà active."}</p>` : ""}
      <div style="margin-top:1.2rem; display:flex; gap:0.6rem; justify-content:center;">
        <button class="bouton-vendre" onclick="document.getElementById('modale-ajout').remove(); ouvrirModaleAjout();">Ajouter un autre stylo</button>
        <button class="bouton-refuser" onclick="document.getElementById('modale-ajout').remove(); if (typeof chargerCatalogue === 'function') chargerCatalogue();">Fermer</button>
      </div>
    </div>
  `;
}

const lienAjouterNav = document.getElementById("lien-ajouter");
if (lienAjouterNav) {
  lienAjouterNav.addEventListener("click", (e) => { e.preventDefault(); ouvrirModaleAjout(); });
}