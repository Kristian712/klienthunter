const CZECH_NAMES = new Set([
  // Male
  'Adam','Aleš','Alexej','Alexandr','Alois','Antonín','Bedřich','Bohdan','Bohumil','Bohumír',
  'Bořek','Bořivoj','Břetislav','Cyril','Čeněk','Daniel','Dalibor','David','Dominik','Dušan',
  'Eduard','Emil','Erik','Filip','František','Hugo','Ivo','Ivan','Jakub','Jan','Jaromír',
  'Jaroslav','Jindřich','Jiří','Josef','Kamil','Karel','Ladislav','Libor','Lubomír','Lukáš',
  'Marcel','Marek','Martin','Matěj','Michal','Miloš','Milan','Miloslav','Miroslav','Ondřej',
  'Patrik','Pavel','Petr','Přemysl','Radek','Radim','Radomír','Radoslav','René','Richard',
  'Robert','Roman','Rostislav','Rudolf','Stanislav','Štěpán','Tomáš','Václav','Viktor',
  'Vladimír','Vladislav','Vojtěch','Zbyněk','Zdeněk','Zdirad',
  // Female
  'Adéla','Alena','Alexandra','Alžběta','Aneta','Anežka','Anna','Barbora','Blanka','Dana',
  'Daniela','Dagmar','Dita','Dominika','Eva','Gabriela','Hana','Helena','Ilona','Irena',
  'Ivana','Jana','Jitka','Karolína','Kateřina','Klára','Kristýna','Lenka','Linda','Lucie',
  'Ludmila','Marcela','Markéta','Marie','Marta','Martina','Michaela','Milena','Monika',
  'Natálie','Nikola','Pavla','Petra','Radka','Renata','Romana','Simona','Soňa','Stanislava',
  'Šárka','Tereza','Věra','Veronika','Zdenka','Zuzana',
]);

export function toVocative(name: string): string {
  const n = name.trim();
  if (!n) return n;
  const lower = n.toLowerCase();
  const last  = lower[lower.length - 1];
  const last2 = lower.slice(-2);

  if (last2 === 'ie' || last === 'í') return n;
  if (last === 'e' || last === 'o') return n;
  if (last === 'a') return n.slice(0, -1) + 'o';
  if (last2 === 'el') return n.slice(0, -2) + 'le';
  if (last2 === 'ek') return n.slice(0, -2) + 'ku';
  if (last === 'k') return n + 'u';
  if ('šžčřj'.includes(last)) return n + 'i';
  return n + 'e';
}

export function extractFirstName(businessName: string): string | null {
  const clean = businessName.replace(/\b(s\.r\.o\.?|a\.s\.?|v\.o\.s\.?|spol\.|IČ\s*\d+|IČO\s*\d+)\b/gi, '');
  const words = clean.split(/[\s\-–,/]+/).map(w => w.replace(/[^a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, ''));
  for (const word of words) {
    const cap = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    if (CZECH_NAMES.has(cap) && word.length > 2) return cap;
  }
  return null;
}

export function buildGreeting(businessName: string): string {
  const firstName = extractFirstName(businessName);
  return firstName ? `Dobrý den, ${toVocative(firstName)},` : 'Dobrý den,';
}
