const DEFAULT_OVERLAY = "linear-gradient(180deg, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.85))"

export const backgroundOptions = [
  {
    id: "sunrise",
    label: "Sunrise Peaks",
    image: "/mountain-bg.jpg",
    gradient: DEFAULT_OVERLAY,
  },
  {
    id: "clouds",
    label: "Cloud Drift",
    image: "/clouds.jpg",
    gradient: "linear-gradient(180deg, rgba(8, 24, 46, 0.65), rgba(3, 9, 18, 0.9))",
  },
  {
    id: "cloudyhills",
    label: "Hilltop Mist",
    image: "/cloudyhills.jpg",
    gradient: "linear-gradient(180deg, rgba(6, 18, 32, 0.7), rgba(2, 8, 16, 0.92))",
  },
  {
    id: "falllake",
    label: "Autumn Lake",
    image: "/falllake.jpg",
    gradient: "linear-gradient(180deg, rgba(32, 14, 6, 0.7), rgba(14, 5, 2, 0.92))",
  },
  {
    id: "fieldmountain",
    label: "Valley Fields",
    image: "/fieldmountain.jpg",
    gradient: "linear-gradient(180deg, rgba(8, 26, 18, 0.7), rgba(3, 10, 7, 0.92))",
  },
  {
    id: "flowers",
    label: "Wildflower",
    image: "/flowers.jpg",
    gradient: "linear-gradient(180deg, rgba(36, 10, 14, 0.65), rgba(18, 3, 6, 0.9))",
  },
  {
    id: "greylakemountain",
    label: "Misty Range",
    image: "/greylakemountain.jpg",
    gradient: "linear-gradient(180deg, rgba(14, 18, 24, 0.7), rgba(6, 8, 12, 0.92))",
  },
  {
    id: "jungley",
    label: "Jungle Canopy",
    image: "/jungley.jpg",
    gradient: "linear-gradient(180deg, rgba(6, 30, 16, 0.65), rgba(2, 14, 8, 0.92))",
  },
  {
    id: "oceanmountain",
    label: "Ocean Rise",
    image: "/oceanmountain.jpg",
    gradient: "linear-gradient(180deg, rgba(6, 20, 36, 0.7), rgba(2, 8, 16, 0.92))",
  },
  {
    id: "ontopmountain",
    label: "Summit Skies",
    image: "/ontopmountain.jpg",
    gradient: "linear-gradient(180deg, rgba(26, 12, 6, 0.7), rgba(8, 4, 2, 0.92))",
  },
  {
    id: "rockyhills",
    label: "Rocky Ridge",
    image: "/rockyhills.jpg",
    gradient: "linear-gradient(180deg, rgba(20, 10, 6, 0.68), rgba(8, 4, 2, 0.9))",
  },
  {
    id: "savannah",
    label: "Savannah Glow",
    image: "/savannah.jpg",
    gradient: "linear-gradient(180deg, rgba(32, 18, 6, 0.7), rgba(14, 8, 2, 0.92))",
  },
]

export const getBackgroundImage = (id: string | undefined) => {
  const option = backgroundOptions.find((opt) => opt.id === id) ?? backgroundOptions[0]
  const layers = [option.gradient || DEFAULT_OVERLAY]
  if (option.image) {
    layers.push(`url(${option.image})`)
  }
  return layers.join(", ")
}
