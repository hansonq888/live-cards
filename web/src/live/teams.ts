import type { MatchMeta } from "./protocol";

/** A club's side of the match meta (name, colour, attack direction) from its code. */
export const teamOf = (meta: MatchMeta, code: string | undefined) => (code === meta.home.code ? meta.home : meta.away);
