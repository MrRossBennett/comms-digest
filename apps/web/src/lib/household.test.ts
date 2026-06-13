import { expect, test } from "vite-plus/test";

import { householdSetupSchema } from "./household";

test("Household setup collects only the School and minimal Child matching details", () => {
  expect(
    householdSetupSchema.parse({
      schoolName: "Riverside Primary",
      children: [
        {
          displayName: "Alex",
          schoolYear: "Year 4",
          className: "4B",
        },
        {
          displayName: "Sam",
          schoolYear: "Year 6",
          className: "",
        },
      ],
    }),
  ).toEqual({
    schoolName: "Riverside Primary",
    children: [
      {
        displayName: "Alex",
        schoolYear: "Year 4",
        className: "4B",
      },
      {
        displayName: "Sam",
        schoolYear: "Year 6",
        className: null,
      },
    ],
  });

  expect(() =>
    householdSetupSchema.parse({
      schoolName: "Riverside Primary",
      children: [
        {
          displayName: "Alex",
          schoolYear: "Year 4",
          surname: "Example",
          dateOfBirth: "2016-02-03",
        },
      ],
    }),
  ).toThrow();
});
