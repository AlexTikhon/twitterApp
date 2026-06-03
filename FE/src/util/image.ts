// Converts the selected file into a base64 string for the GraphQL mutations.
// Reads an image File as a data URL so it can be sent in GraphQL variables.
export const generateBase64FromImage = async imageFile => {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = e => resolve(e.target.result);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(imageFile);
  });
};
