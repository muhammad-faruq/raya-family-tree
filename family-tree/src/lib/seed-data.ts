/**
 * Seed data for the family tree with integer IDs.
 * Format matches family-chart Data (id as string for API compatibility).
 */
export const SEED_PEOPLE = [
  {
    id: 1,
    data: {
      "first name": "Agnus",
      "last name": "",
      birthday: "1970",
      avatar:
        "https://static8.depositphotos.com/1009634/988/v/950/depositphotos_9883921-stock-illustration-no-user-profile-picture.jpg",
      gender: "M",
    },
    rels: { spouses: [2], children: [5, 6], parents: [3, 4] },
  },
  {
    id: 2,
    data: {
      gender: "F",
      "first name": "Andrea",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { spouses: [1], children: [5, 6], parents: [12, 13] },
  },
  {
    id: 3,
    data: {
      gender: "M",
      "first name": "Zen",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { children: [1], spouses: [4], parents: [] },
  },
  {
    id: 4,
    data: {
      gender: "F",
      "first name": "Zebra",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { spouses: [3], children: [1], parents: [10, 11] },
  },
  {
    id: 5,
    data: {
      gender: "M",
      "first name": "Ben",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { spouses: [8], children: [7, 9], parents: [1, 2] },
  },
  {
    id: 6,
    data: {
      gender: "F",
      "first name": "Becky",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { parents: [1, 2], spouses: [], children: [] },
  },
  {
    id: 7,
    data: {
      gender: "M",
      "first name": "Carlos",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { parents: [5, 8], spouses: [], children: [] },
  },
  {
    id: 8,
    data: {
      gender: "F",
      "first name": "Branka",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { spouses: [5], children: [7, 9] },
  },
  {
    id: 9,
    data: {
      gender: "F",
      "first name": "Carla",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { parents: [5, 8], spouses: [], children: [] },
  },
  {
    id: 10,
    data: {
      gender: "M",
      "first name": "Yvo",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { children: [4], spouses: [11], parents: [] },
  },
  {
    id: 11,
    data: {
      gender: "F",
      "first name": "Yva",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { spouses: [10], children: [4], parents: [] },
  },
  {
    id: 12,
    data: {
      gender: "M",
      "first name": "Zadro",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { children: [2], spouses: [13], parents: [] },
  },
  {
    id: 13,
    data: {
      gender: "F",
      "first name": "Zadra",
      "last name": "",
      birthday: "",
      avatar: "",
    },
    rels: { spouses: [12], children: [2], parents: [] },
  },
];
