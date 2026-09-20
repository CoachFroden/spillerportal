# Samnanger G14 – Spillerportal

Ny mobil spillerportal.

Identitet:
- Firebase Auth UID = konto.
- playerAccounts/{uid} = ny spillerkonto.
- spillere/{playerId} = eksisterende spillerregister.
- Coach kobler konto til spiller ved godkjenning.
- Gamle spilleroppføringer i users røres ikke.

Firestore-reglene i firestore.rules er et tillegg som må flettes inn i gjeldende produksjonsregler før portalen tas i bruk. Kampdata og Kamprommet åpnes først etter kontroll av hvilke data og hvilken auth som er trygge for spillere.
