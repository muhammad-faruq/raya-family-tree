/**
 * Seed data for the family tree.
 * generation field drives the overview layout:
 *   0 = grandparents (Jahabar/Noorjan side + Muhammad Yun/Nyai side)
 *   1 = parents' generation (Jahangeer, Rafidah, their siblings)
 *   2 = your generation (Mirza, Faruq, Hanis, cousins)
 *   3 = children's generation (Raisin, future grandkids)
 */
export const SEED_PEOPLE = [
  // ── Generation 1: Jahangeer & Rafidah (the nucleus) ──────────────────────
  {
    id: 1,
    generation: 1,
    data: {
      "first name": "Jahangeer Bin Mohamed Jahabar",
      "last name": "",
      birthday: "08 June 1972",
      avatar: "https://icons.veryicon.com/png/o/object/material-design-icons/face-2.png",
      gender: "M",
    },
    rels: { spouses: [2], children: [3, 6, 7], parents: [4, 5] },
  },
  {
    id: 2,
    generation: 1,
    data: {
      "first name": "Rafidah Bte Muhammad Yun",
      "last name": "",
      birthday: "1971",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [1], children: [3, 6, 7], parents: [8, 9] },
  },

  // ── Generation 2: Jahangeer & Rafidah's children ──────────────────────────
  {
    id: 3,
    generation: 2,
    data: {
      "first name": "Muhammad Mirza Bin Jahangeer",
      "last name": "",
      birthday: "1997",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [21], children: [], parents: [1, 2] },
  },
  {
    id: 6,
    generation: 2,
    data: {
      "first name": "Muhammad Faruq Bin Jahangeer",
      "last name": "",
      birthday: "1999",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [], children: [], parents: [1, 2] },
  },
  {
    id: 7,
    generation: 2,
    data: {
      "first name": "Nur Hanis Bte Jahangeer",
      "last name": "",
      birthday: "2003",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [], children: [], parents: [1, 2] },
  },

  // ── Generation 0: Jahangeer's parents ─────────────────────────────────────
  {
    id: 4,
    generation: 0,
    data: {
      "first name": "Jahabar s/o Sayabugani",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [5], children: [1, 16, 17, 18], parents: [] },
  },
  {
    id: 5,
    generation: 0,
    data: {
      "first name": "Noorjan",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [4], children: [1, 16, 17, 18], parents: [] },
  },

  // ── Generation 0: Rafidah's parents ──────────────────────────────────────
  {
    id: 8,
    generation: 0,
    data: {
      "first name": "Muhammad Yun",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [9], children: [2, 10], parents: [] },
  },
  {
    id: 9,
    generation: 0,
    data: {
      "first name": "Nyai (idk her actual name) habsah?",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [8], children: [2, 10], parents: [] },
  },

  // ── Generation 1: Jahangeer's siblings ────────────────────────────────────
  {
    id: 16,
    generation: 1,
    data: {
      "first name": "Jamal",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [], children: [], parents: [4, 5] },
  },
  {
    id: 17,
    generation: 1,
    data: {
      "first name": "Jahirah",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [22], children: [23, 24], parents: [4, 5] },
  },
  {
    id: 18,
    generation: 1,
    data: {
      "first name": "Julaiha",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [], children: [], parents: [4, 5] },
  },

  // ── Generation 1: Rafidah's sibling + spouse ──────────────────────────────
  {
    id: 10,
    generation: 1,
    data: {
      "first name": "Mami Azizah",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [11], children: [12, 13, 14, 15], parents: [9, 8] },
  },
  {
    id: 11,
    generation: 1,
    data: {
      "first name": "Wak Samad",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [10], children: [12, 13, 14, 15], parents: [] },
  },

  // ── Generation 1: Jahirah's spouse ────────────────────────────────────────
  {
    id: 22,
    generation: 1,
    data: {
      "first name": "Mama Harris",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [17], children: [23, 24], parents: [] },
  },

  // ── Generation 2: Mami Azizah's children ─────────────────────────────────
  {
    id: 12,
    generation: 2,
    data: {
      "first name": "Nadirah",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [19], children: [20], parents: [10, 11] },
  },
  {
    id: 13,
    generation: 2,
    data: {
      "first name": "Nabilah",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [], children: [], parents: [10, 11] },
  },
  {
    id: 14,
    generation: 2,
    data: {
      "first name": "Luqman",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [], children: [], parents: [10, 11] },
  },
  {
    id: 15,
    generation: 2,
    data: {
      "first name": "Hidayah",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [], children: [], parents: [10, 11] },
  },

  // ── Generation 2: Jahirah's children ─────────────────────────────────────
  {
    id: 23,
    generation: 2,
    data: {
      "first name": "Hanan Kong",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [], children: [], parents: [17, 22] },
  },
  {
    id: 24,
    generation: 2,
    data: {
      "first name": "Ronaa Kong",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [], children: [], parents: [17, 22] },
  },

  // ── Generation 2: Nadirah's spouse (married in) ───────────────────────────
  {
    id: 19,
    generation: 2,
    data: {
      "first name": "Danial",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [12], children: [20], parents: [] },
  },

  // ── Generation 2: Mirza's spouse (married in) ─────────────────────────────
  {
    id: 21,
    generation: 2,
    data: {
      "first name": "Nazurah",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "F",
    },
    rels: { spouses: [3], children: [], parents: [] },
  },

  // ── Generation 3: Nadirah & Danial's child ────────────────────────────────
  {
    id: 20,
    generation: 3,
    data: {
      "first name": "Raisin",
      "last name": "",
      birthday: "",
      avatar: "",
      gender: "M",
    },
    rels: { spouses: [], children: [], parents: [12, 19] },
  },
];
