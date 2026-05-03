export const reverseGeocode = async (lat, lon) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MedAssistApp/1.0' },
  });
  const data = await response.json();
  if (data && data.display_name) {
    return data.display_name;
  } else {
    throw new Error('Adresse non trouvée');
  }
};