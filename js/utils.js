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

// URL publique de la photo principale d'un stylo (ou la première si aucune n'est marquée principale)
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