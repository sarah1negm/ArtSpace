export interface Artwork {
  readonly id: number;
  readonly title: string;
  readonly artist: string;
  readonly description: string;
  readonly price: number;
  readonly image: string;
}
// Placeholder photography for the mock collection.
export const ARTWORKS: readonly Artwork[] = [
  {
    id: 1,
    title: 'Sunset Dreams',
    artist: 'Student Artist 1',
    price: 120,
    description: 'A study of warm evening light and quiet horizons.',
    image: 'https://picsum.photos/seed/artwork1/800/600',
  },
  {
    id: 2,
    title: 'Ocean Waves',
    artist: 'Student Artist 2',
    price: 200,
    description: 'An exploration of movement, depth, and the rhythm of the sea.',
    image: 'https://picsum.photos/seed/artwork2/800/600',
  },
  {
    id: 3,
    title: 'Colorful World',
    artist: 'Student Artist 3',
    price: 150,
    description: 'Everyday beauty expressed through contrasting colors and playful forms.',
    image: 'https://picsum.photos/seed/artwork3/800/600',
  },
];
