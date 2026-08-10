// ajouter.js — popup "Ajouter un stylo" : sélecteurs visuels, photo principale + secondaires, retour clair

const SOUS_CATEGORIES_AJOUT = {
  touristique: ["Ville", "Monument", "Institution", "Région/Département/Pays"],
  publicitaire: ["Entreprise", "Association", "Institution", "Sport", "Événement"]
};

const RARETES_AJOUT = [
  { valeur: "commun", label: "Commun" },
  { valeur: "peu_commun", label: "Peu commun" },
  { valeur: "rare", label: "Rare" },
  { valeur: "tres_rare", label: "Très rare" },
  { valeur: "exceptionnel", label: "Exceptionnel" }
];

let categoriesChoisiesAjout = new Set();
let rareteChoisieAjout = "commun";
let sousCategorieChoisieAjout = "";
let fichierPrincipalAjout = null;
let fichiersSecondairesAjout = [];

async function ouvrirModaleAjout() {
  const session = await verifierConnexion();
  if (!session) {
    construireModaleAuth();
    return;
  }

  categoriesChoisiesAjout = new Set();
  rareteChoisieAjout = "commun";
  sousCategorieChoisieAjout = "";
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
        <label>Nom du stylo
          <input type="text" id="ajout-nom" required>
        </label>
        <label>Lieu ou entreprise représenté
          <input type="text" id="ajout-lieu" required>
        </label>
        <div style="display:flex; gap:0.8rem;">
          <label style="flex:1;">Ville
            <input type="text" id="ajout-ville">
          </label>
          <label style="flex:1;">Pays
            <input type="text" id="ajout-pays" value="France">
          </label>
        </div>
        <label>Région
          <input type="text" id="ajout-region">
        </label>
        <label>Coordonnées GPS (format : lat, lng)
          <input type="text" id="ajout-coordonnees" placeholder="43.206261, 2.364185">
        </label>

        <label>Catégorie(s)</label>
        <div class="selecteur-categories" id="selecteur-categories">
          <div class="option-categorie" data-valeur="touristique">Touristique</div>
          <div class="option-categorie" data-valeur="publicitaire">Publicitaire</div>
        </div>

        <div id="zone-sous-categories" style="display:none;">
          <label>Sous-catégorie</label>
          <div class="selecteur-chips" id="selecteur-chips"></div>
        </div>

        <label>Rareté</label>
        <div class="selecteur-raretes" id="selecteur-raretes">
          ${RARETES_AJOUT.map(r => `<div class="option-rarete ${r.valeur === 'commun' ? 'selectionnee' : ''}" data-valeur="${r.valeur}">${r.label}</div>`).join("")}
        </div>

        <div style="display:flex; gap:0.8rem;">
          <label style="flex:1;">Prix d'achat (€)
            <input type="number" step="0.01" id="ajout-prix-achat">
          </label>
          <label style="flex:1;">Valeur estimée (€)
            <input type="number" step="0.01" id="ajout-valeur-estimee">
          </label>
        </div>

        <label>Description
          <textarea id="ajout-description"></textarea>
        </label>

        <label>Photo principale
          <input type="file" id="ajout-photo-principale" accept="image/*">
        </label>
        <div class="apercu-photos" id="apercu-principale"></div>

        <label>Photos secondaires (optionnel, plusieurs possibles)
          <input type="file" id="ajout-photos-secondaires" accept="image/*" multiple>
        </label>
        <div class="apercu-photos" id="apercu-secondaires"></div>

        <button type="submit">Envoyer</button>
        <p id="ajout-message"></p>
      </form>
      <div id="ajout-succes" style="display:none;"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll(".option-categorie").forEach(el => {
    el.addEventListener("click", () => {
      const valeur = el.dataset.valeur;
      if (categoriesChoisiesAjout.has(valeur)) {
        categoriesChoisiesAjout.delete(valeur);
        el.classList.remove("selectionnee");
      } else {
        categoriesChoisiesAjout.add(valeur);
        el.classList.add("selectionnee");
      }
      rafraichirSousCategoriesAjout(overlay);
    });
  });

  overlay.querySelectorAll(".option-rarete").forEach(el => {
    el.addEventListener("click", () => {
      overlay.querySelectorAll(".option-rarete").forEach(o => o.classList.remove("selectionnee"));
      el.classList.add("selectionnee");
      rareteChoisieAjout = el.dataset.valeur;
    });
  });

  document.getElementById("ajout-photo-principale").addEventListener("change", (e) => {
    fichierPrincipalAjout = e.target.files[0] || null;
    const apercu = document.getElementById("apercu-principale");
    apercu.innerHTML = fichierPrincipalAjout ? `<img src="${URL.createObjectURL(fichierPrincipalAjout)}" class="apercu-photo">` : "";
  });

  document.getElementById("ajout-photos-secondaires").addEventListener("change", (e) => {
    fichiersSecondairesAjout = Array.from(e.target.files);
    const apercu = document.getElementById("apercu-secondaires");
    apercu.innerHTML = fichiersSecondairesAjout.map(f => `<img src="${URL.createObjectURL(f)}" class="apercu-photo">`).join("");
  });

  document.getElementById("form-ajout-popup").addEventListener("submit", (e) => envoyerFormulaireAjout(e, session));
}

function rafraichirSousCategoriesAjout(overlay) {
  const zone = overlay.querySelector("#zone-sous-categories");
  const chips = overlay.querySelector("#selecteur-chips");
  const options = new Set();
  categoriesChoisiesAjout.forEach(cat => (SOUS_CATEGORIES_AJOUT[cat] || []).forEach(s => options.add(s)));

  if (options.size === 0) {
    zone.style.display = "none";
    sousCategorieChoisieAjout = "";
    return;
  }

  zone.style.display = "block";
  chips.innerHTML = Array.from(options).map(nom => `<div class="chip-sous-categorie" data-valeur="${nom}">${nom}</div>`).join("");
  chips.querySelectorAll(".chip-sous-categorie").forEach(chip => {
    chip.addEventListener("click", () => {
      chips.querySelectorAll(".chip-sous-categorie").forEach(c => c.classList.remove("selectionnee"));
      chip.classList.add("selectionnee");
      sousCategorieChoisieAjout = chip.dataset.valeur;
    });
  });
}

async function envoyerFormulaireAjout(e, session) {
  e.preventDefault();
  const message = document.getElementById("ajout-message");
  message.textContent = "Envoi en cours...";
  message.style.color = "black";

  const nom = document.getElementById("ajout-nom").value;
  const utilisateurId = session.user.id;

  const coordonneesTexte = document.getElementById("ajout-coordonnees").value;
  let latitude = null;
  let longitude = null;
  if (coordonneesTexte.includes(",")) {
    const parties = coordonneesTexte.split(",");
    latitude = parseFloat(parties[0].trim());
    longitude = parseFloat(parties[1].trim());
    if (isNaN(latitude) || isNaN(longitude)) { latitude = null; longitude = null; }
  }

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

  const { data: stylo, error: erreurStylo } = await supabaseClient
    .from("stylos")
    .insert({
      nom: nom,
      lieu_ou_entreprise: document.getElementById("ajout-lieu").value,
      ville: document.getElementById("ajout-ville").value || null,
      region: document.getElementById("ajout-region").value || null,
      pays: document.getElementById("ajout-pays").value || "France",
      latitude: latitude,
      longitude: longitude,
      rarete: rareteChoisieAjout,
      prix_achat: document.getElementById("ajout-prix-achat").value || null,
      valeur_estimee: document.getElementById("ajout-valeur-estimee").value || null,
      description: document.getElementById("ajout-description").value || null,
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

  if (categoriesChoisiesAjout.size > 0) {
    const { data: categories } = await supabaseClient
      .from("categories")
      .select("id, nom")
      .in("nom", Array.from(categoriesChoisiesAjout));
    if (categories) {
      const liaisons = categories.map(c => ({ stylo_id: stylo.id, categorie_id: c.id }));
      await supabaseClient.from("stylo_categories").insert(liaisons);
    }
  }

  if (sousCategorieChoisieAjout) {
    const { data: sousCategorie } = await supabaseClient
      .from("sous_categories")
      .select("id")
      .eq("nom", sousCategorieChoisieAjout)
      .single();
    if (sousCategorie) {
      await supabaseClient.from("stylo_sous_categories").insert({
        stylo_id: stylo.id,
        sous_categorie_id: sousCategorie.id
      });
    }
  }

  const photosAEnvoyer = [];
  if (fichierPrincipalAjout) photosAEnvoyer.push({ fichier: fichierPrincipalAjout, principale: true });
  fichiersSecondairesAjout.forEach(f => photosAEnvoyer.push({ fichier: f, principale: false }));

  for (let i = 0; i < photosAEnvoyer.length; i++) {
    const { fichier, principale } = photosAEnvoyer[i];
    const cheminFichier = `${stylo.id}/${i}-${fichier.name}`;
    const { error: erreurUpload } = await supabaseClient.storage
      .from("stylos-photos")
      .upload(cheminFichier, fichier);
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

  afficherSuccesAjout(statutInitial, raisonModeration);
}

function afficherSuccesAjout(statutInitial, raisonModeration) {
  document.getElementById("form-ajout-popup").style.display = "none";
  const zoneSucces = document.getElementById("ajout-succes");
  zoneSucces.style.display = "block";
  zoneSucces.innerHTML = `
    <div class="ajout-succes">
      <div class="coche">✓</div>
      <h3>${statutInitial === "valide" ? "Stylo ajouté au catalogue !" : "Stylo envoyé pour validation"}</h3>
      ${raisonModeration ? `<p class="badge-raison">${raisonModeration}</p>` : ""}
      <p style="color:#6B6558;">${statutInitial === "valide" ? "Il apparaît déjà dans le catalogue." : "Il apparaîtra dans le catalogue une fois approuvé par un modérateur."}</p>
      <div style="margin-top:1.2rem; display:flex; gap:0.6rem; justify-content:center;">
        <button class="bouton-vendre" onclick="document.getElementById('modale-ajout').remove(); ouvrirModaleAjout();">Ajouter un autre stylo</button>
        <button class="bouton-refuser" onclick="document.getElementById('modale-ajout').remove(); if (typeof chargerCatalogue === 'function') chargerCatalogue();">Fermer</button>
      </div>
    </div>
  `;
}

// Branche le lien "Ajouter un stylo" du menu sur la popup, sur chaque page où le script est chargé
const lienAjouterNav = document.getElementById("lien-ajouter");
if (lienAjouterNav) {
  lienAjouterNav.addEventListener("click", (e) => { e.preventDefault(); ouvrirModaleAjout(); });
}