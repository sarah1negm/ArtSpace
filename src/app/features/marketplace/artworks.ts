export const CATEGORIES = ['Painting', 'Print', 'Other'] as const;
export type ArtworkCategory = (typeof CATEGORIES)[number];

export interface Artwork {
  readonly category: ArtworkCategory;
  /** Mock likes, used for popularity sorting. */
  readonly popularity: number;
  readonly id: number;
  readonly title: string;
  readonly artist: string;
  readonly description: string;
  readonly price: number;
  readonly image: string;
}
// Original local illustrations for the mock collection; no external image requests.
export const ARTWORKS: readonly Artwork[] = [
  {
    id: 1,
    category: 'Painting',
    popularity: 48,
    title: 'Sunset Dreams',
    artist: 'Student Artist 1',
    price: 120,
    description: 'A study of warm evening light and quiet horizons.',
    image: 'artworks/sunset-dreams.svg',
  },
  {
    id: 2,
    category: 'Print',
    popularity: 125,
    title: 'Ocean Waves',
    artist: 'Student Artist 2',
    price: 200,
    description: 'An exploration of movement, depth, and the rhythm of the sea.',
    image: 'artworks/ocean-waves.svg',
  },
  {
    id: 3,
    category: 'Other',
    popularity: 76,
    title: 'Colorful World',
    artist: 'Student Artist 3',
    price: 150,
    description: 'Everyday beauty expressed through contrasting colors and playful forms.',
    image: 'artworks/colorful-world.svg',
  },
];
