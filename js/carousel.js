let stylosCarrousel = [];
let pageCarrouselActuelle = 0;
let intervalCarrousel;

function afficherPageCarrousel() {
  const container = document.getElementById("carrousel");
  if (stylosCarrousel.length === 0) {
    container.innerHTML = "<p>Pas encore de stylos à découvrir.</p>";
    return;
  }
  const debut = pageCarrouselActuelle * 3;
  const stylosAffiches = stylosCarrousel.slice(debut, debut + 3);
  container.innerHTML = `<div class="grille-stylos">` + stylosAffiches.map(stylo => {
    const urlPhoto = obtenirUrlPhoto(stylo);
    return `
<a href="fiche-stylo.html?stylo=${stylo.id}" class="lien-photo-carte" style="text-decoration: none; color: inherit;">        <div class="carte-stylo">
          ${urlPhoto ? `<img src="${urlPhoto}" alt="${stylo.nom}" class="photo-carte">` : `<div class="photo-carte photo-manquante">Pas de photo</div>`}
          <div class="infos-carte">
            <h3><span class="repere-4c"><span></span><span></span><span></span><span></span></span>${stylo.nom}</h3>
          </div>
        </div>
      </a>
    `;
  }).join("") + `</div>`;
}

async function initialiserCarrousel() {
  const { data: stylos, error } = await supabaseClient
    .from("stylos")
    .select("id, nom, photos(storage_path, est_principale)")
    .eq("statut_moderation", "valide")
    .limit(12);

  if (error || !stylos) return;
  stylosCarrousel = stylos;
  afficherPageCarrousel();

  const nombreDePages = Math.ceil(stylosCarrousel.length / 3);
  if (nombreDePages <= 1) return;
  intervalCarrousel = setInterval(() => {
    pageCarrouselActuelle = (pageCarrouselActuelle + 1) % nombreDePages;
    afficherPageCarrousel();
  }, 5000);
}

initialiserCarrousel();