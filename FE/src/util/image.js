export const generateBase64FromImage = async imageFile => {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = e => resolve(e.target.result);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(imageFile);
  });
};
