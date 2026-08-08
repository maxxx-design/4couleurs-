async function testerConnexion() {
  const { data, error } = await supabaseClient.from("categories").select("*");
  const zone = document.getElementById("test-connexion");

  if (error) {
    zone.textContent = "Erreur de connexion : " + error.message;
    console.error(error);
  } else {
    zone.textContent = "Connexion réussie ! Catégories trouvées : " + data.map(c => c.nom).join(", ");
    console.log(data);
  }
}

testerConnexion();