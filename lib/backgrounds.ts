const DEFAULT_OVERLAY = "linear-gradient(180deg, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.85))"

export const backgroundOptions = [
  {
    id: "sunrise",
    label: "Sunrise Peaks",
    image: "/mountain-bg.jpg",
    gradient: DEFAULT_OVERLAY,
  },
  // {
  //   id: "forest",
  //   label: "Evergreen Retreat",
  //   image: "/backgrounds/forest.jpg",
  //   gradient: "linear-gradient(180deg, rgba(4, 12, 8, 0.75), rgba(1, 3, 2, 0.95))",
  // },
  // {
  //   id: "twilight",
  //   label: "Twilight Glow",
  //   image: "/backgrounds/twilight.jpg",
  //   gradient: "linear-gradient(180deg, rgba(12, 2, 24, 0.65), rgba(1, 0, 5, 0.95))",
  // },
  // {
  //   id: "aurora",
  //   label: "Aurora Mist",
  //   image: "/backgrounds/aurora.jpg",
  //   gradient: "linear-gradient(180deg, rgba(2, 15, 20, 0.6), rgba(1, 4, 8, 0.9))",
  // },
]

export const getBackgroundImage = (id: string | undefined) => {
  const option = backgroundOptions.find((opt) => opt.id === id) ?? backgroundOptions[0]
  const layers = [option.gradient || DEFAULT_OVERLAY]
  if (option.image) {
    layers.push(`url(${option.image})`)
  }
  return layers.join(", ")
}
