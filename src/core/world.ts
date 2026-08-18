export type MapSizeId = 'small' | 'medium' | 'large' | 'huge';

/** Current baseline battlefield is 120 wide. Small is 3× that. */
export const MAP_SIZES: Record<MapSizeId, { label: string; world: number; hint: string }> = {
  small: { label: 'Small', world: 360, hint: '3× original' },
  medium: { label: 'Medium', world: 540, hint: '4.5× original' },
  large: { label: 'Large', world: 720, hint: '6× original' },
  huge: { label: 'Huge', world: 1080, hint: '9× original' },
};

export const DEFAULT_MAP_SIZE: MapSizeId = 'small';

export const MAP_SIZE_ORDER: MapSizeId[] = ['small', 'medium', 'large', 'huge'];

export function worldSizeFor(id: MapSizeId): number {
  return MAP_SIZES[id].world;
}

export function isMapSizeId(value: string | undefined): value is MapSizeId {
  return !!value && value in MAP_SIZES;
}
