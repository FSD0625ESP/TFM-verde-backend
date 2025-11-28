// utils/generateSlug.js
import slugify from "slugify";

export const generateSlug = (text) => {
  if (!text) return "";

  return slugify(text, {
    lower: true, // convierte a minúsculas
    strict: true, // elimina caracteres especiales
    locale: "es", // soporte para tildes y ñ
    trim: true,
  });
};
