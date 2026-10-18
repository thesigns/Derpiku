// Derpiku — the spirit constellation (GDD 6.5). Single source of parameters: used by the game and the orbit simulator.
// The constellation is closed: 26 spirits, one per letter A–Z. Orbits must never change after release.
(function (root) {
  'use strict';
  const SPIRITS = [
    { animal: "Axolotl"  , name: "Axolotl Spirit"  , group: "very rare" , color: '#f472b6', inclination: 63, periodMin: 1187, raan: 215, phase: 190, rangeKm:   900 },
    { animal: "Bee"      , name: "Bee Spirit"      , group: "medium"    , color: '#facc15', inclination: 33, periodMin:  151, raan: 330, phase:  20, rangeKm:  3500 },
    { animal: "Cat"      , name: "Cat Spirit"      , group: "common"    , color: '#fb923c', inclination: 48, periodMin:   97, raan:  22, phase:  40, rangeKm:  4500 },
    { animal: "Dog"      , name: "Dog Spirit"      , group: "common"    , color: '#c08457', inclination: 57, periodMin:  131, raan: 160, phase: 210, rangeKm:  4500 },
    { animal: "Elephant" , name: "Elephant Spirit" , group: "regional"  , color: '#9aa5c4', inclination: 30, periodMin:  541, raan: 290, phase:  15, rangeKm:  2500 },
    { animal: "Frog"     , name: "Frog Spirit"     , group: "common"    , color: '#4ade80', inclination: 38, periodMin:  113, raan: 245, phase: 120, rangeKm:  4500 },
    { animal: "Goose"    , name: "Goose Spirit"    , group: "medium"    , color: '#7dd3fc', inclination: 75, periodMin:  181, raan:  95, phase: 310, rangeKm:  3500 },
    { animal: "Hedgehog" , name: "Hedgehog Spirit" , group: "common"    , color: '#b45309', inclination: 51, periodMin:  143, raan: 300, phase:  80, rangeKm:  4500 },
    { animal: "Iguana"   , name: "Iguana Spirit"   , group: "regional"  , color: '#a3e635', inclination:  9, periodMin:  223, raan: 140, phase: 100, rangeKm:  2500 },
    { animal: "Jellyfish", name: "Jellyfish Spirit", group: "medium"    , color: '#c084fc', inclination: 29, periodMin:  311, raan:  15, phase: 200, rangeKm:  3500 },
    { animal: "Koala"    , name: "Koala Spirit"    , group: "regional"  , color: '#9cb8a5', inclination: 28, periodMin:  293, raan: 175, phase: 340, rangeKm:  2000 },
    { animal: "Llama"    , name: "Llama Spirit"    , group: "medium"    , color: '#e879f9', inclination: 41, periodMin:  239, raan: 130, phase: 150, rangeKm:  3500 },
    { animal: "Moth"     , name: "Moth Spirit"     , group: "medium"    , color: '#c4b5fd', inclination: 61, periodMin:  367, raan:  50, phase: 140, rangeKm:  3500 },
    { animal: "Narwhal"  , name: "Narwhal Spirit"  , group: "polar"     , color: '#22d3ee', inclination: 88, periodMin: 1307, raan:  45, phase: 160, rangeKm:  1500 },
    { animal: "Owl"      , name: "Owl Spirit"      , group: "medium"    , color: '#6366f1', inclination: 72, periodMin:  263, raan: 120, phase: 170, rangeKm:  3500 },
    { animal: "Pigeon"   , name: "Pigeon Spirit"   , group: "background", color: '#94a3b8', inclination: 52, periodMin:  300, raan:   0, phase:   0, rangeKm: 20015 },
    { animal: "Quokka"   , name: "Quokka Spirit"   , group: "very rare" , color: '#fb7185', inclination: 45, periodMin:  977, raan: 310, phase:  75, rangeKm:   900 },
    { animal: "Rabbit"   , name: "Rabbit Spirit"   , group: "common"    , color: '#fecaca', inclination: 44, periodMin:  109, raan: 200, phase: 260, rangeKm:  4500 },
    { animal: "Snail"    , name: "Snail Spirit"    , group: "rare"      , color: '#2dd4bf', inclination: 47, periodMin: 2111, raan: 270, phase: 330, rangeKm:  2200 },
    { animal: "Turtle"   , name: "Turtle Spirit"   , group: "regional"  , color: '#16a34a', inclination: 21, periodMin:  457, raan:  10, phase: 230, rangeKm:  2000 },
    { animal: "Urchin"   , name: "Urchin Spirit"   , group: "rare"      , color: '#be123c', inclination: 59, periodMin: 1709, raan: 340, phase: 120, rangeKm:  1200 },
    { animal: "Vole"     , name: "Vole Spirit"     , group: "medium"    , color: '#8d7b68', inclination: 55, periodMin:  197, raan: 260, phase:  35, rangeKm:  3500 },
    { animal: "Whale"    , name: "Whale Spirit"    , group: "rare"      , color: '#2563eb', inclination: 69, periodMin: 1523, raan: 100, phase:  60, rangeKm:  1500 },
    { animal: "Xerus"    , name: "Xerus Spirit"    , group: "regional"  , color: '#d97706', inclination: 14, periodMin:  331, raan: 200, phase:  30, rangeKm:  2200 },
    { animal: "Yak"      , name: "Yak Spirit"      , group: "polar"     , color: '#7c4a2d', inclination: 80, periodMin:  277, raan: 230, phase:  90, rangeKm:  3000 },
    { animal: "Zebra"    , name: "Zebra Spirit"    , group: "regional"  , color: '#64748b', inclination:  5, periodMin:  409, raan:  60, phase: 250, rangeKm:  2800 },
  ];
  if (typeof module === 'object' && module.exports) module.exports = SPIRITS;
  else root.DERPIKU_SPIRITS = SPIRITS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
