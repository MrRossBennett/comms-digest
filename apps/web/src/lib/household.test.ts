import { expect, test } from "vite-plus/test";

import { householdSetupSchema } from "./household";

test("Household setup collects only the School and minimal Child matching details", () => {
  expect(
    householdSetupSchema.parse({
      schools: [
        { key: "riverside", name: "Riverside Primary" },
        { key: "hillcrest", name: "Hillcrest Secondary" },
      ],
      children: [
        {
          key: "alex",
          displayName: "Alex",
          schoolYear: "Year 4",
          className: "4B",
          schoolKey: "riverside",
        },
        {
          key: "sam",
          displayName: "Sam",
          schoolYear: "Year 6",
          className: "",
          schoolKey: "hillcrest",
        },
      ],
    }),
  ).toEqual({
    schools: [
      { key: "riverside", name: "Riverside Primary" },
      { key: "hillcrest", name: "Hillcrest Secondary" },
    ],
    children: [
      {
        key: "alex",
        displayName: "Alex",
        schoolYear: "Year 4",
        className: "4B",
        schoolKey: "riverside",
      },
      {
        key: "sam",
        displayName: "Sam",
        schoolYear: "Year 6",
        className: null,
        schoolKey: "hillcrest",
      },
    ],
  });

  expect(() =>
    householdSetupSchema.parse({
      schools: [{ key: "riverside", name: "Riverside Primary" }],
      children: [
        {
          key: "alex",
          displayName: "Alex",
          schoolYear: "Year 4",
          schoolKey: "riverside",
          surname: "Example",
          dateOfBirth: "2016-02-03",
        },
      ],
    }),
  ).toThrow();
});

test("every Child must be assigned to a School in the Household", () => {
  expect(() =>
    householdSetupSchema.parse({
      schools: [{ key: "riverside", name: "Riverside Primary" }],
      children: [
        {
          key: "sam",
          displayName: "Sam",
          schoolYear: "Year 6",
          schoolKey: "hillcrest",
        },
      ],
    }),
  ).toThrow("assigned to a School");
});
