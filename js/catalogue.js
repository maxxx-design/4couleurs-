// catalogue.js — catalogue complet, avec tri Touristique / Publicitaire et carte conditionnelle
// (fusionne ce qui était avant réparti sur index.html, touristique.html et publicitaire.html)

let tousLesStylos = [];
let compteurVentesGlobal = {};
let idsFavoris = new Set();
let monIdUtilisateur = null;

const SOUS_CATEGORIES = {
  touristique: ["Ville", "Monument", "Institution", "Région/Département/Pays"],
  publicitaire: ["Entreprise", "Association", "Institution", "Sport", "Événement"]
};

let carte;
let groupeMarqueurs;

function initialiserCarte() {
  if (carte) return;
  carte = L.map('carte').setView([46.6, 2.5], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(carte);
  groupeMarqueurs = L.markerClusterGroup();
  carte.addLayer(groupeMarqueurs);
}

function afficherMarqueurs(stylos) {
  if (!carte || !groupeMarqueurs) return;
  groupeMarqueurs.clearLayers();
  stylos.filter(s => s.latitude && s.longitude).forEach(stylo => {
    const marqueur = L.marker([stylo.latitude, stylo.longitude])
      .bindPopup(`<strong>${stylo.nom}</strong><br>${stylo.lieu_ou_entreprise}`);
    groupeMarqueurs.addLayer(marqueur);
  });
}

// Affiche ou masque la carte : mise en avant pour le tri Touristique,
// masquée pour Publicitaire (pas pertinente), visible par défaut pour Tous
function mettreAJourVisibiliteCarte(categorieChoisie) {
  const zoneCarte = document.getElementById("carte");
  if (!zoneCarte) return;
  if (categorieChoisie === "publicitaire") {
    zoneCarte.style.display = "none";
  } else {
    zoneCarte.style.display = "block";
    if (carte) setTimeout(() => carte.invalidateSize(), 50);
  }
}

function remplirSousCategories(categorieChoisie) {
  const selectSous = document.getElementById("filtre-sous-categorie");
  const valeurPrecedente = selectSous.value;
  selectSous.innerHTML = '<option value="">Toutes sous-catégories</option>';
  if (categorieChoisie && SOUS_CATEGORIES[categorieChoisie]) {
    selectSous.style.display = "inline-block";
    SOUS_CATEGORIES[categorieChoisie].forEach(nom => {
      const option = document.createElement("option");
      option.value = nom;
      option.textContent = nom;
      selectSous.appendChild(option);
    });
    if (SOUS_CATEGORIES[categorieChoisie].includes(valeurPrecedente)) {
      selectSous.value = valeurPrecedente;
    }
  } else {
    selectSous.style.display = "none";
  }
}

function remplirFiltrePays(stylos) {
  const select = document.getElementById("filtre-pays");
  const valeurPrecedente = select.value;
select.innerHTML = '<option value="">Pays</option>';
  const paysUniques = [...new Set(stylos.map(s => s.pays).filter(Boolean))].sort();
  paysUniques.forEach(pays => {
    const option = document.createElement("option");
    option.value = pays;
    option.textContent = pays;
    select.appendChild(option);
  });
  select.value = valeurPrecedente;
}

function carteHtml(stylo, compteurVentes) {
  const nbEnVente = compteurVentes[stylo.id] || 0;
  const urlPhoto = obtenirUrlPhoto(stylo);
  const estFavori = idsFavoris.has(stylo.id);
  return `
    <div class="carte-stylo">
      <a href="fiche-stylo.html?stylo=${stylo.id}" class="lien-photo-carte">
        ${urlPhoto
          ? `<img src="${urlPhoto}" alt="${stylo.nom}" class="photo-carte">`
          : `<div class="photo-carte photo-manquante">Pas de photo</div>`
        }
      </a>
      <div class="infos-carte">
        ${monIdUtilisateur ? `<button class="bouton-favori" onclick="toggleFavori('${stylo.id}')">${estFavori ? '♥' : '♡'}</button>` : ''}
        <h3>${stylo.nom}</h3>
        ${badgeRareteHtml(stylo.rarete)}
        ${nbEnVente > 0 ? `<a href="fiche-stylo.html?stylo=${stylo.id}" class="badge-vente">${nbEnVente} en vente</a>` : ""}
        <a href="vendre.html?stylo=${stylo.id}" class="bouton-vendre">Vendre ce stylo</a>
      </div>
    </div>
  `;
}

function afficherStylos(stylos, compteurVentes) {
  const container = document.getElementById("liste-stylos");
  const sectionFavoris = document.getElementById("section-favoris");
  const listeFavoris = document.getElementById("liste-favoris");

  const favorisAffiches = stylos.filter(s => idsFavoris.has(s.id));
  const resteAffiches = stylos.filter(s => !idsFavoris.has(s.id));

  if (favorisAffiches.length > 0) {
    sectionFavoris.style.display = "block";
    listeFavoris.innerHTML = favorisAffiches.map(s => carteHtml(s, compteurVentes)).join("");
  } else {
    sectionFavoris.style.display = "none";
  }

  if (resteAffiches.length === 0 && favorisAffiches.length === 0) {
    container.innerHTML = "<p>Aucun stylo ne correspond à ta recherche.</p>";
    return;
  }
  container.innerHTML = resteAffiches.map(s => carteHtml(s, compteurVentes)).join("");
}

window.toggleFavori = async function (styloId) {
  if (idsFavoris.has(styloId)) {
    await supabaseClient.from("favoris").delete().eq("utilisateur_id", monIdUtilisateur).eq("stylo_id", styloId);
    idsFavoris.delete(styloId);
  } else {
    await supabaseClient.from("favoris").insert({ utilisateur_id: monIdUtilisateur, stylo_id: styloId });
    idsFavoris.add(styloId);
  }
  appliquerFiltres();
};

function appliquerFiltres() {
  const terme = document.getElementById("recherche").value;
  const categorieChoisie = document.getElementById("filtre-categorie").value;
  const sousCategorieChoisie = document.getElementById("filtre-sous-categorie").value;
  const rareteChoisie = document.getElementById("filtre-rarete").value;
  const paysChoisi = document.getElementById("filtre-pays").value;

  mettreAJourVisibiliteCarte(categorieChoisie);

  const filtres = tousLesStylos.filter(stylo => {
    const correspondTerme = !terme ||
      correspondApproximativement(stylo.nom, terme) ||
      correspondApproximativement(stylo.lieu_ou_entreprise, terme) ||
      correspondApproximativement(stylo.ville, terme);

    const categoriesDuStylo = (stylo.stylo_categories || []).map(sc => sc.categories.nom);
    const correspondCategorie = !categorieChoisie || categoriesDuStylo.includes(categorieChoisie);

    const sousCategoriesDuStylo = (stylo.stylo_sous_categories || []).map(ssc => ssc.sous_categories.nom);
    const correspondSousCategorie = !sousCategorieChoisie || sousCategoriesDuStylo.includes(sousCategorieChoisie);

    const correspondRarete = !rareteChoisie || stylo.rarete === rareteChoisie;
    const correspondPays = !paysChoisi || stylo.pays === paysChoisi;

    return correspondTerme && correspondCategorie && correspondSousCategorie && correspondRarete && correspondPays;
  });

  afficherStylos(filtres, compteurVentesGlobal);
  afficherMarqueurs(filtres);
}

async function chargerCatalogue() {
  initialiserCarte();
  const container = document.getElementById("liste-stylos");
  const session = await verifierConnexion();

  if (session) {
    monIdUtilisateur = session.user.id;
    const { data: favoris } = await supabaseClient
      .from("favoris")
      .select("stylo_id")
      .eq("utilisateur_id", monIdUtilisateur);
    if (favoris) idsFavoris = new Set(favoris.map(f => f.stylo_id));
  }

  const { data: stylos, error: erreurStylos } = await supabaseClient
    .from("stylos")
.select("*, stylo_categories(categories(nom)), stylo_sous_categories(sous_categories(nom)), photos(storage_path, est_principale)")    .order("nom", { ascending: true });

  if (erreurStylos) {
    container.innerHTML = "<p>Erreur de chargement : " + erreurStylos.message + "</p>";
    console.error(erreurStylos);
    return;
  }

  const { data: annonces } = await supabaseClient
    .from("annonces")
    .select("stylo_id")
    .eq("statut", "active");

  const compteurVentes = {};
  if (annonces) {
    annonces.forEach(a => {
      compteurVentes[a.stylo_id] = (compteurVentes[a.stylo_id] || 0) + 1;
    });
  }

  tousLesStylos = stylos;
compteurVentesGlobal = compteurVentes;
remplirFiltrePays(stylos);
afficherStylos(stylos, compteurVentes);
afficherMarqueurs(stylos);
mettreAJourVisibiliteCarte("");
setTimeout(() => carte.invalidateSize(), 150);
}

document.getElementById("recherche").addEventListener("input", appliquerFiltres);
document.getElementById("filtre-categorie").addEventListener("change", (e) => {
  remplirSousCategories(e.target.value);
  appliquerFiltres();
});
document.getElementById("filtre-sous-categorie").addEventListener("change", appliquerFiltres);
document.getElementById("filtre-rarete").addEventListener("change", appliquerFiltres);
document.getElementById("filtre-pays").addEventListener("change", appliquerFiltres);

chargerCatalogue();