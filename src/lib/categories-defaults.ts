export interface CategoryDefault {
  name: string;
  icon: string;
}

// Categorías argentinas sugeridas al usuario en el onboarding.
// Para agregar una categoría sugerida: agregar un objeto a este array.
export const DEFAULT_CATEGORIES: CategoryDefault[] = [
  { name: "Supermercado", icon: "🛒" },
  { name: "Transporte", icon: "🚌" },
  { name: "Alquiler", icon: "🏠" },
  { name: "Salud y Farmacia", icon: "💊" },
  { name: "Nafta", icon: "⛽" },
  { name: "Delivery y Restaurantes", icon: "🍕" },
  { name: "Servicios", icon: "💡" },
  { name: "Ropa", icon: "👕" },
  { name: "Entretenimiento", icon: "🎬" },
  { name: "Telefonía e Internet", icon: "📱" },
  { name: "Mascotas", icon: "🐾" },
  { name: "Educación", icon: "📚" },
  { name: "Gimnasio", icon: "🏋️" },
  { name: "Regalos", icon: "🎁" },
  { name: "Viajes", icon: "✈️" },
  { name: "Ahorro / Fondo", icon: "🐷" },
];
