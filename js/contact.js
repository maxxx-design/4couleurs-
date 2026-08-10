// contact.js — prise de contact avec un vendeur, utilisée depuis annonces.html et fiche-stylo.html

async function contacterVendeur(annonceId, vendeurId) {
  const session = await verifierConnexion();
  if (!session) {
    construireModaleAuth();
    return;
  }
  const monId = session.user.id;
  if (monId === vendeurId) {
    alert("C'est ta propre annonce, tu ne peux pas te contacter toi-même.");
    return;
  }

  const { data: conversationsExistantes } = await supabaseClient
    .from("conversations")
    .select("id")
    .eq("annonce_id", annonceId)
    .or(`and(participant_1.eq.${monId},participant_2.eq.${vendeurId}),and(participant_1.eq.${vendeurId},participant_2.eq.${monId})`);

  if (conversationsExistantes && conversationsExistantes.length > 0) {
    window.location.href = "mes-messages.html?conversation=" + conversationsExistantes[0].id;
    return;
  }

  const { data: nouvelleConversation, error } = await supabaseClient
    .from("conversations")
    .insert({ type: "annonce", annonce_id: annonceId, participant_1: monId, participant_2: vendeurId })
    .select()
    .single();

  if (error) {
    alert("Erreur : " + error.message);
    console.error(error);
    return;
  }
  window.location.href = "mes-messages.html?conversation=" + nouvelleConversation.id;
}