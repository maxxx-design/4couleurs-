document.getElementById("form-inscription").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pseudo = document.getElementById("pseudo").value;
  const email = document.getElementById("email").value;
  const motDePasse = document.getElementById("mot-de-passe").value;
  const message = document.getElementById("message-inscription");

  message.textContent = "Création du compte...";
  message.style.color = "black";

  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: motDePasse
  });

  if (error) {
    message.textContent = "Erreur : " + error.message;
    message.style.color = "red";
    return;
  }

  const nouvelUtilisateurId = data.user.id;

  const { error: erreurProfil } = await supabaseClient.from("profils").insert({
    id: nouvelUtilisateurId,
    pseudo: pseudo
  });

  if (erreurProfil) {
    message.textContent = "Compte créé, mais erreur sur le profil : " + erreurProfil.message;
    message.style.color = "orange";
    return;
  }

  message.textContent = "Compte créé ! Redirection...";
  message.style.color = "green";
  setTimeout(() => { window.location.href = "index.html"; }, 800);
});