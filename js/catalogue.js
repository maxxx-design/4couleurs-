// catalogue.js — catalogue séparé automatiquement en sections Touristique / Publicitaire
// (un stylo qui a les deux catégories apparaît dans les deux sections)

let tousLesStylos = [];
let compteurVentesGlobal = {};
let idsFavoris = new Set();
let monIdUtilisateur = null;

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
      .bindPopup(`<strong>${stylo.nom}</strong><br>${texteLieuEntreprise(stylo)}`);
    groupeMarqueurs.addLayer(marqueur);
  });
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
  const sectionFavoris = document.getElementById("section-favoris");
  const listeFavoris = document.getElementById("liste-favoris");
  const sectionTouristique = document.getElementById("section-touristique");
  const listeTouristique = document.getElementById("liste-touristique");
  const sectionPublicitaire = document.getElementById("section-publicitaire");
  const listePublicitaire = document.getElementById("liste-publicitaire");

  const favorisAffiches = stylos.filter(s => idsFavoris.has(s.id));
  if (favorisAffiches.length > 0) {
    sectionFavoris.style.display = "block";
    listeFavoris.innerHTML = favorisAffiches.map(s => carteHtml(s, compteurVentes)).join("");
  } else {
    sectionFavoris.style.display = "none";
  }

  const estTouristique = s => (s.stylo_categories || []).some(sc => sc.categories.nom === "touristique");
  const estPublicitaire = s => (s.stylo_categories || []).some(sc => sc.categories.nom === "publicitaire");

  const touristiques = stylos.filter(estTouristique);
  const publicitaires = stylos.filter(estPublicitaire);

  if (touristiques.length > 0) {
    sectionTouristique.style.display = "block";
    listeTouristique.innerHTML = touristiques.map(s => carteHtml(s, compteurVentes)).join("");
  } else {
    sectionTouristique.style.display = "none";
    listeTouristique.innerHTML = "";
  }

  if (publicitaires.length > 0) {
    sectionPublicitaire.style.display = "block";
    listePublicitaire.innerHTML = publicitaires.map(s => carteHtml(s, compteurVentes)).join("");
  } else {
    sectionPublicitaire.style.display = "none";
    listePublicitaire.innerHTML = "";
  }

  if (touristiques.length === 0 && publicitaires.length === 0 && favorisAffiches.length === 0) {
    sectionTouristique.style.display = "block";
    listeTouristique.innerHTML = "<p>Aucun stylo ne correspond à ta recherche.</p>";
  }
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
  const rareteChoisie = document.getElementById("filtre-rarete").value;
  const paysChoisi = document.getElementById("filtre-pays").value;

  const filtres = tousLesStylos.filter(stylo => {
    const correspondTerme = !terme ||
      correspondApproximativement(stylo.nom, terme) ||
      correspondApproximativement(stylo.lieu_ou_entreprise, terme) ||
      correspondApproximativement(stylo.entreprise_representee, terme) ||
      correspondApproximativement(stylo.ville, terme);

    const correspondRarete = !rareteChoisie || stylo.rarete === rareteChoisie;
    const correspondPays = !paysChoisi || stylo.pays === paysChoisi;

    return correspondTerme && correspondRarete && correspondPays;
  });

  afficherStylos(filtres, compteurVentesGlobal);
  afficherMarqueurs(filtres.filter(s => (s.stylo_categories || []).some(sc => sc.categories.nom === "touristique")));
}

async function chargerCatalogue() {
  initialiserCarte();
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
    .select("*, stylo_categories(categories(nom)), stylo_sous_categories(sous_categories(nom)), photos(storage_path, est_principale)")
    .eq("statut_moderation", "valide")
    .order("nom", { ascending: true });

  if (erreurStylos) {
    document.getElementById("liste-touristique").innerHTML = "<p>Erreur de chargement : " + erreurStylos.message + "</p>";
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
  afficherMarqueurs(stylos.filter(s => (s.stylo_categories || []).some(sc => sc.categories.nom === "touristique")));
  setTimeout(() => carte.invalidateSize(), 150);
}

document.getElementById("recherche").addEventListener("input", appliquerFiltres);
document.getElementById("filtre-rarete").addEventListener("change", appliquerFiltres);
document.getElementById("filtre-pays").addEventListener("change", appliquerFiltres);

chargerCatalogue();