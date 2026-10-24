// The two fictional clubs' identities: everything about a club that isn't in the match feed.
// Invented from scratch (towns, grounds, history); no real club, place or badge is referenced.
// Kit colours mirror backend/livecards/sim/roster.py so crests and the pitch always agree.

export interface Club {
  code: string;
  name: string;
  short: string;       // what a scoreline or headline would call them
  nickname: string;
  founded: number;
  city: string;
  region: string;
  stadium: string;
  capacity: number;
  history: string;     // one line, for club panels
  color: string;       // primary kit
  secondary: string;   // second kit colour
  ink: string;         // dark trim used on the crest
}

export const CLUBS: Record<string, Club> = {
  RIV: {
    code: "RIV",
    name: "Riverside FC",
    short: "Riverside",
    nickname: "The Tide",
    founded: 1886,
    city: "Saltmere",
    region: "the Wenmoor coast",
    stadium: "Harbour Lane",
    capacity: 31400,
    history: "Founded by dockworkers on the Saltmere quays; the lighthouse on the crest stands at the harbour mouth where they first played.",
    color: "#d3302a",
    secondary: "#ffffff",
    ink: "#7a1813",
  },
  NGT: {
    code: "NGT",
    name: "Northgate Athletic",
    short: "Northgate",
    nickname: "The Gatemen",
    founded: 1903,
    city: "Hollinsby",
    region: "the Fellmoor hills",
    stadium: "Gatehouse Park",
    capacity: 27850,
    history: "Formed by workers from the Hollinsby mills and named after the old north gate of the walled town, which still sits on the crest.",
    color: "#2158a8",
    secondary: "#0b1a3a",
    ink: "#0b1a3a",
  },
};

export function club(code: string): Club | undefined {
  return CLUBS[code];
}
