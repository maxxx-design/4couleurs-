(async function initPageVente() {
  const params = new URLSearchParams(window.location.search);
  const styloId = params.get("stylo");
  const infoStylo = document.getElementById("info-stylo");

  if (!styloId) {
    infoStylo.innerHTML = "<p>Aucun stylo sélectionné.</p>";
    return;
  }

  const session = await verifierConnexion();
  const zoneNonConnecte = document.getElementById("zone-non-connecte");
  const formulaire = document.getElementById("form-vente");

  const { data: stylo, error: erreurStylo } = await supabaseClient
    .from("stylos")
    .select("id, nom, lieu_ou_entreprise, rarete")
    .eq("id", styloId)
    .single();

  if (erreurStylo || !stylo) {
    infoStylo.innerHTML = "<p>Stylo introuvable.</p>";
    return;
  }

  infoStylo.innerHTML = `
    <div class="carte-stylo">
      <h3>${stylo.nom}</h3>
      <p>${stylo.lieu_ou_entreprise}</p>
      <p class="rarete">${stylo.rarete}</p>
    </div>
  `;

  if (!session) {
    zoneNonConnecte.style.display = "block";
    formulaire.style.display = "none";
    return;
  }

  const zonePossession = document.getElementById("zone-possession");
  const { data: possessionExistante } = await supabaseClient
    .from("possessions")
    .select("*")
    .eq("utilisateur_id", session.user.id)
    .eq("stylo_id", styloId)
    .maybeSingle();

  let jePossede = !!possessionExistante;

  function rendreZonePossession() {
    zonePossession.innerHTML = `
      <label style="display:flex; align-items:center; gap:0.5rem; font-weight:normal; text-transform:none;">
        <input type="checkbox" id="case-possession" ${jePossede ? "checked" : ""}>
        Je possède ce stylo
      </label>
    `;
    document.getElementById("case-possession").addEventListener("change", async (e) => {
      if (e.target.checked) {
        await supabaseClient.from("possessions").insert({ utilisateur_id: session.user.id, stylo_id: styloId });
        jePossede = true;
      } else {
        await supabaseClient.from("possessions").delete().eq("utilisateur_id", session.user.id).eq("stylo_id", styloId);
        jePossede = false;
      }
    });
  }
  rendreZonePossession();

  zoneNonConnecte.style.display = "none";
  formulaire.style.display = "block";
  const utilisateurId = session.user.id;

  formulaire.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = document.getElementById("message-vente");
    message.textContent = "Publication en cours...";
    message.style.color = "black";

    const prixSaisi = parseFloat(document.getElementById("prix").value);
    const statutInitial = prixSaisi >= 20 ? "en_attente" : "active";

    const { error } = await supabaseClient.from("annonces").insert({
      stylo_id: styloId,
      vendeur_id: utilisateurId,
      prix: prixSaisi,
      description: document.getElementById("description-annonce").value || null,
      statut: statutInitial
    });

    if (error) {
      message.textContent = "Erreur : " + error.message;
      message.style.color = "red";
      console.error(error);
      return;
    }

    message.textContent = statutInitial === "active"
      ? "Annonce publiée !"
      : "Prix supérieur à 20€ — annonce envoyée pour validation manuelle.";
    message.style.color = "green";
    formulaire.reset();
  });
})();