export const markerConfigs = [
  { file: '/models/bp-60-new.glb', clipIndex: 0, baked: true }, // 0: 60 YEARS logo
  { file: '/models/indonesian-map.glb', clipIndex: 0, baked: true }, // 1: Indonesia map
  { file: '/models/bp-jacket.glb', clipIndex: 0, baked: true, rotatable: true }, // 2: Square pattern
  { file: '/models/ship-ocean.glb', clipIndex: 0, baked: true }, // 3: Tag / container
  {
    file: '/models/ccus.glb',
    clipIndex: 0,
    uvScrollY: ['line'],
    uvScrollReverse: ['red lines 2', 'yellow lines', 'blue line'],
  }, // 4: CO2
  { file: '/models/ground-monas.glb', playAllClips: true }, // 5: Bor
]

export const BP_JACKET_INDEX = 2
export const SHIP_OCEAN_INDEX = 3
export const CCUS_INDEX = 4
