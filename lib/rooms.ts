export type Room = {
  name: string;
  memberPriceKr: number;
  tracks: string[];
};

// Demo data until rooms are stored in a database. Keys are URL-safe slugs.
const rooms: Record<string, Room> = {
  "fjorden-baby": {
    name: "Fjorden Baby",
    memberPriceKr: 19,
    tracks: [
      "Night Ferry (Demo)",
      "Blue Hour — live at home",
      "After the rain (instrumental)",
    ],
  },
};

export const SAMPLE_ROOM_SLUG = "fjorden-baby";

export function getRoom(slug: string): Room | undefined {
  return Object.hasOwn(rooms, slug) ? rooms[slug] : undefined;
}

export function getRoomSlugs(): string[] {
  return Object.keys(rooms);
}
