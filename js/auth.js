// auth.js — session, état de la nav, et popup obligatoire de connexion / inscription

async function verifierConnexion() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}

async function afficherEtatConnexion() {
  const lien = document.getElementById("lien-connexion");
  const lienProfil = document.getElementById("lien-profil");
  const session = await verifierConnexion();

  if (session) {
    if (lien) {
      lien.textContent = "Se déconnecter";
      lien.href = "#";
      lien.onclick = async (e) => {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        window.location.href = "accueil.html";
      };
    }
    if (lienProfil) {
      lienProfil.href = `profil.html?id=${session.user.id}`;
      lienProfil.style.display = "inline";
    }
    const { data: profil } = await supabaseClient
      .from("profils")
      .select("est_admin")
      .eq("id", session.user.id)
      .maybeSingle();
    if (profil && profil.est_admin && lien && !document.getElementById("lien-moderation")) {
      const lienModeration = document.createElement("a");
      lienModeration.id = "lien-moderation";
      lienModeration.href = "moderation.html";
      lienModeration.textContent = "Modération";
      lien.parentNode.insertBefore(lienModeration, lien);
    }
  } else {
    if (lien) {
      lien.textContent = "Se connecter";
      lien.href = "#";
      lien.onclick = (e) => { e.preventDefault(); construireModaleAuth(); };
    }
    if (lienProfil) lienProfil.style.display = "none";
  }
}

// ---- Popup de connexion / inscription ----

function construireModaleAuth() {
  if (document.getElementById("modale-auth")) return;

  const overlay = document.createElement("div");
  overlay.id = "modale-auth";
  overlay.className = "modale-fond";
  overlay.innerHTML = `
    <div class="modale-auth-boite">
      <div class="bandeau-4c"><span></span><span></span><span></span><span></span></div>
      <h2>Bienvenue</h2>
      <p class="modale-soustitre">Connecte-toi ou crée un compte pour accéder au catalogue et à la marketplace.</p>
      <div class="modale-onglets">
        <button type="button" class="onglet-actif" id="onglet-connexion">Se connecter</button>
        <button type="button" id="onglet-inscription">Créer un compte</button>
      </div>
      <form id="form-modale-connexion" class="formulaire">
        <label>Email<input type="email" id="modale-email-connexion" required></label>
        <label>Mot de passe<input type="password" id="modale-mdp-connexion" required></label>
        <button type="submit">Se connecter</button>
        <p id="modale-message-connexion"></p>
      </form>
      <form id="form-modale-inscription" class="formulaire" style="display:none;">
        <label>Pseudo<input type="text" id="modale-pseudo" required></label>
        <label>Email<input type="email" id="modale-email-inscription" required></label>
        <label>Mot de passe (6 caractères min.)<input type="password" id="modale-mdp-inscription" required minlength="6"></label>
        <button type="submit">Créer mon compte</button>
        <p id="modale-message-inscription"></p>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("modale-ouverte");

  const ongletConnexion = document.getElementById("onglet-connexion");
  const ongletInscription = document.getElementById("onglet-inscription");
  const formConnexion = document.getElementById("form-modale-connexion");
  const formInscription = document.getElementById("form-modale-inscription");

  ongletConnexion.addEventListener("click", () => {
    ongletConnexion.classList.add("onglet-actif");
    ongletInscription.classList.remove("onglet-actif");
    formConnexion.style.display = "flex";
    formInscription.style.display = "none";
  });
  ongletInscription.addEventListener("click", () => {
    ongletInscription.classList.add("onglet-actif");
    ongletConnexion.classList.remove("onglet-actif");
    formInscription.style.display = "flex";
    formConnexion.style.display = "none";
  });

  formConnexion.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = document.getElementById("modale-message-connexion");
    message.textContent = "Connexion...";
    message.style.color = "black";
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: document.getElementById("modale-email-connexion").value,
      password: document.getElementById("modale-mdp-connexion").value
    });
    if (error) {
      message.textContent = "Erreur : " + error.message;
      message.style.color = "red";
      return;
    }
    apresAuthReussie();
  });

  formInscription.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = document.getElementById("modale-message-inscription");
    message.textContent = "Création du compte...";
    message.style.color = "black";
    const { data, error } = await supabaseClient.auth.signUp({
      email: document.getElementById("modale-email-inscription").value,
      password: document.getElementById("modale-mdp-inscription").value
    });
    if (error) {
      message.textContent = "Erreur : " + error.message;
      message.style.color = "red";
      return;
    }
    const { error: erreurProfil } = await supabaseClient.from("profils").insert({
      id: data.user.id,
      pseudo: document.getElementById("modale-pseudo").value
    });
    if (erreurProfil) {
      message.textContent = "Compte créé, mais erreur sur le profil : " + erreurProfil.message;
      message.style.color = "orange";
      return;
    }
    apresAuthReussie();
  });
}

function apresAuthReussie() {
  document.body.classList.remove("modale-ouverte");
  const overlay = document.getElementById("modale-auth");
  if (overlay) overlay.remove();
  const cheminActuel = window.location.pathname.split("/").pop();
  if (cheminActuel !== "accueil.html") {
    window.location.href = "accueil.html";
  } else {
    window.location.reload();
  }
}

// Toute personne sans session ouverte voit la popup, quelle que soit la page d'arrivée
async function initGardeAuth() {
  const session = await verifierConnexion();
  if (!session) {
    construireModaleAuth();
  }
}

initGardeAuth();
afficherEtatConnexion();