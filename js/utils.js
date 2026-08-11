// utils.js — fonctions partagées entre plusieurs pages (évite les doublons de code)

function distanceLevenshtein(a, b) {
  const matrice = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrice[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrice[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      matrice[i][j] = Math.min(
        matrice[i - 1][j] + 1,
        matrice[i][j - 1] + 1,
        matrice[i - 1][j - 1] + cout
      );
    }
  }
  return matrice[a.length][b.length];
}

function correspondApproximativement(texte, terme) {
  if (!texte || !terme) return false;
  texte = texte.toLowerCase();
  terme = terme.toLowerCase();
  if (texte.includes(terme)) return true;
  const motsDuTexte = texte.split(/\s+/);
  const seuilTolerance = terme.length <= 4 ? 1 : 2;
  return motsDuTexte.some(mot => distanceLevenshtein(mot, terme) <= seuilTolerance);
}

function obtenirUrlPhoto(stylo) {
  if (!stylo || !stylo.photos || stylo.photos.length === 0) return null;
  const principale = stylo.photos.find(p => p.est_principale) || stylo.photos[0];
  return supabaseClient.storage.from("stylos-photos").getPublicUrl(principale.storage_path).data.publicUrl;
}

let _idCompteSystemeCache = null;
async function obtenirIdCompteSysteme() {
  if (_idCompteSystemeCache) return _idCompteSystemeCache;
  const { data } = await supabaseClient.from("profils").select("id").eq("est_systeme", true).maybeSingle();
  _idCompteSystemeCache = data ? data.id : null;
  return _idCompteSystemeCache;
}

async function enregistrerVueAnnonce(annonceId) {
  await supabaseClient.rpc('incrementer_vue_annonce', { id_annonce: annonceId });
}

async function compterFavorisStylo(styloId) {
  const { data } = await supabaseClient.rpc('compter_favoris_stylo', { id_stylo: styloId });
  return data || 0;
}

// ---- Rareté : libellés + couleurs reprises du stylo 4 couleurs ----
const LABELS_RARETE = {
  commun: "Commun",
  peu_commun: "Peu commun",
  rare: "Rare",
  tres_rare: "Très rare",
  exceptionnel: "Exceptionnel"
};
const COULEURS_RARETE = {
  commun: { fond: "transparent", texte: "var(--encre)", bordure: "var(--ligne-forte)" },
  peu_commun: { fond: "#EDEAE3", texte: "var(--encre)", bordure: "var(--ligne-forte)" },
  rare: { fond: "var(--bic-vert)", texte: "#ffffff", bordure: "var(--bic-vert)" },
  tres_rare: { fond: "var(--bic-bleu)", texte: "#ffffff", bordure: "var(--bic-bleu)" },
  exceptionnel: { fond: "var(--bic-rouge)", texte: "#ffffff", bordure: "var(--bic-rouge)" }
};
function badgeRareteHtml(rarete) {
  const c = COULEURS_RARETE[rarete] || COULEURS_RARETE.commun;
  const label = LABELS_RARETE[rarete] || rarete;
  return `<span class="badge-rarete" style="background:${c.fond}; color:${c.texte}; border-color:${c.bordure};">${label}</span>`;
}