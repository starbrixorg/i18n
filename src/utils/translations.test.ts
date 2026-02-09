/* eslint-disable no-template-curly-in-string */
import {
  flattenTranslations,
  sortTranslations,
  unflattenTranslations,
  getTranslationChanges,
  getChangesSummary,
  applyPatch,
  areTranslationsEqual,
} from "./translations"
import { describe, expect, test } from "vitest"

describe("flattenTranslations", () => {
  test("flattens nested translation objects correctly", () => {
    const nestedTranslations = {
      user: {
        profile: {
          name: "Name",
          email: "Email",
        },
        settings: {
          theme: "Theme",
        },
      },
      common: {
        save: "Save",
        cancel: "Cancel",
      },
    }

    const expectedFlatTranslations = {
      "user.profile.name": "Name",
      "user.profile.email": "Email",
      "user.settings.theme": "Theme",
      "common.save": "Save",
      "common.cancel": "Cancel",
    }

    const flatTranslations = flattenTranslations(nestedTranslations)
    expect(flatTranslations).toEqual(expectedFlatTranslations)
  })
})

describe("unflattenTranslations", () => {
  test("unflattens flat translation objects correctly", () => {
    const flatTranslations = {
      "user.profile.name": "Name",
      "user.profile.email": "Email",
      "user.settings.theme": "Theme",
      "common.save": "Save",
      "common.cancel": "Cancel",
    }

    const expectedNestedTranslations = {
      user: {
        profile: {
          name: "Name",
          email: "Email",
        },
        settings: {
          theme: "Theme",
        },
      },
      common: {
        save: "Save",
        cancel: "Cancel",
      },
    }

    const nestedTranslations = unflattenTranslations(flatTranslations)
    expect(nestedTranslations).toEqual(expectedNestedTranslations)
  })
})

describe("sortTranslations", () => {
  test("sorts translation objects alphabetically by keys", () => {
    const translations = {
      user: {
        settings: {
          theme: "Theme",
        },
        profile: {
          email: "Email",
          name: "Name",
        },
      },
      common: {
        cancel: "Cancel",
        save: "Save",
      },
    }

    const expectedSortedTranslations = {
      common: {
        cancel: "Cancel",
        save: "Save",
      },
      user: {
        profile: {
          email: "Email",
          name: "Name",
        },
        settings: {
          theme: "Theme",
        },
      },
    }

    const expected = JSON.stringify(expectedSortedTranslations)
    const actual = JSON.stringify(sortTranslations(translations))

    expect(actual).toBe(expected)
  })
})

describe("areTranslationsEqual", () => {
  const testTranslationValues = [
    // Simple cases
    ["Hello", "hello", true],
    ["Hello ", "hello", true],
    ["Hello\n", "hello", true],
    ["Hello   world", "hello world", true],
    ["Hello\nworld", "hello world", true],
    ["Hello\r\nworld", "hello world", true],
    // Mixed whitespace and interpolation
    ["  Hello   {{ name }}  ", "hello {name}", true],
    ["Hello, {{user}}!", "hello, {user}!", true],
    // Different values
    ["Hello", "Goodbye", false],
    ["Hello {{name}}", "Hello", false],
    ["Hello, world!", "hello world", false],
    // Edge cases
    ["", "", true],
    [" ", "", true],
    ["Hello {name}", "hello {name}", true],
    ["Price: $10", "price: $10", true],
    // Multiple interpolations with different styles
    ["Hello {{first}} {{last}}", "hello ${firstName} %{lastName}", true],
    // Interpolation with dots
    ["Hello {{user.name}}", "hello %{user.firstName}", true],
    ["Hello {user.name}", "hello ${user.userName}", true],
  ]

  testTranslationValues.forEach(([val1, val2, expected]) => {
    test(`areTranslationsEqual("${val1}", "${val2}") should be ${expected}`, () => {
      const result = areTranslationsEqual(val1 as string, val2 as string)
      expect(result).toBe(expected)
    })
  })
})

describe("getTranslationChanges", () => {
  test("identifies added, modified, and removed translations correctly, in nested translations object", () => {
    const baseTranslations = {
      greeting: "Hello",
      farewell: "Goodbye",
      nested: {
        welcome: "Welcome",
        thanks: "Thank you",
      },
    }

    const patchTranslations = {
      greeting: "Hi", // modified
      nested: {
        welcome: "Welcome", // unchanged
        goodbye: "See you", // added
      },
      newKey: "New Value", // added
    }

    const expectedChanges = {
      added: {
        nested: {
          goodbye: "See you",
        },
        newKey: "New Value",
      },
      modified: {
        greeting: "Hi",
      },
      removed: {
        farewell: "Goodbye",
        nested: {
          thanks: "Thank you",
        },
      },
      patch: {
        nested: {
          goodbye: "See you",
        },
        newKey: "New Value",
        greeting: "Hi",
      },
    }

    const changes = getTranslationChanges({
      base: baseTranslations,
      patch: patchTranslations,
    })
    expect(changes).toEqual(expectedChanges)

    const summary = getChangesSummary(changes)
    expect(summary).toEqual({
      addedKeys: ["nested.goodbye", "newKey"],
      modifiedKeys: ["greeting"],
      removedKeys: ["farewell", "nested.thanks"],
    })
  })

  test("identifies changes correctly with flat translation objects", () => {
    const baseTranslations = {
      greeting: "Hello",
      farewell: "Goodbye",
      "nested.welcome": "Welcome",
      "nested.thanks": "Thank you",
    }

    const patchTranslations = {
      greeting: "Hi", // modified
      "nested.welcome": "Welcome", // unchanged
      "nested.goodbye": "See you", // added
      newKey: "New Value", // added
    }

    const expectedChanges = {
      added: {
        nested: {
          goodbye: "See you",
        },
        newKey: "New Value",
      },
      modified: {
        greeting: "Hi",
      },
      removed: {
        farewell: "Goodbye",
        nested: {
          thanks: "Thank you",
        },
      },
      patch: {
        nested: {
          goodbye: "See you",
        },
        newKey: "New Value",
        greeting: "Hi",
      },
    }

    const changes = getTranslationChanges({
      base: baseTranslations,
      patch: patchTranslations,
    })
    expect(changes).toEqual(expectedChanges)

    const summary = getChangesSummary(changes)
    expect(summary).toEqual({
      addedKeys: ["nested.goodbye", "newKey"],
      modifiedKeys: ["greeting"],
      removedKeys: ["farewell", "nested.thanks"],
    })
  })

  test("handles empty translation objects", () => {
    const baseTranslations = {}
    const patchTranslations = {
      hello: "Hello",
    }

    const expectedChanges = {
      added: {
        hello: "Hello",
      },
      modified: {},
      removed: {},
      patch: {
        hello: "Hello",
      },
    }

    const changes = getTranslationChanges({
      base: baseTranslations,
      patch: patchTranslations,
    })
    expect(changes).toEqual(expectedChanges)

    const summary = getChangesSummary(changes)
    expect(summary).toEqual({
      addedKeys: ["hello"],
      modifiedKeys: [],
      removedKeys: [],
    })
  })

  test("handles identical translation objects", () => {
    const baseTranslations = {
      hello: "Hello",
      goodbye: "Goodbye",
    }
    const patchTranslations = {
      hello: "Hello",
      goodbye: "Goodbye",
    }

    const expectedChanges = {
      added: {},
      modified: {},
      removed: {},
      patch: {},
    }

    const changes = getTranslationChanges({
      base: baseTranslations,
      patch: patchTranslations,
    })
    expect(changes).toEqual(expectedChanges)

    const summary = getChangesSummary(changes)
    expect(summary).toEqual({
      addedKeys: [],
      modifiedKeys: [],
      removedKeys: [],
    })
  })
})

describe("applyPatch", () => {
  test("applies patch to base translations (nested objects)", () => {
    const base = {
      greeting: "Hello",
      farewell: "Goodbye",
      nested: {
        welcome: "Welcome",
        thanks: "Thank you",
      },
    }
    const patch = {
      greeting: "Hi", // modified
      nested: {
        welcome: "Welcome", // unchanged
        goodbye: "See you", // added
      },
      newKey: "New Value", // added
    }
    const expected = {
      greeting: "Hi",
      nested: {
        welcome: "Welcome",
        thanks: "Thank you",
        goodbye: "See you",
      },
      farewell: "Goodbye",
      newKey: "New Value",
    }
    // The result should be sorted by keys
    const sortedExpected = sortTranslations(expected)
    const actual = applyPatch({ base, patch })
    expect(sortTranslations(actual)).toEqual(sortedExpected)
  })

  test("applies patch to base translations (flat objects)", () => {
    const base = {
      greeting: "Hello",
      farewell: "Goodbye",
      "nested.welcome": "Welcome",
      "nested.thanks": "Thank you",
    }
    const patch = {
      greeting: "Hi", // modified
      "nested.welcome": "Welcome", // unchanged
      "nested.goodbye": "See you", // added
      newKey: "New Value", // added
    }
    const expected = {
      greeting: "Hi",
      farewell: "Goodbye",
      nested: {
        welcome: "Welcome",
        thanks: "Thank you",
        goodbye: "See you",
      },
      newKey: "New Value",
    }
    const sortedExpected = sortTranslations(expected)
    const actual = applyPatch({ base, patch })
    expect(sortTranslations(actual)).toEqual(sortedExpected)
  })

  test("patch overrides base values", () => {
    const base = {
      a: "A",
      b: "B",
      c: "C",
    }
    const patch = {
      b: "B2",
      d: "D",
    }
    const expected = {
      a: "A",
      b: "B2",
      c: "C",
      d: "D",
    }
    const sortedExpected = sortTranslations(expected)
    const actual = applyPatch({ base, patch })
    expect(sortTranslations(actual)).toEqual(sortedExpected)
  })

  test("patch with empty patch returns base", () => {
    const base = {
      a: "A",
      b: "B",
    }
    const patch = {}
    const expected = {
      a: "A",
      b: "B",
    }
    const actual = applyPatch({ base, patch })
    expect(sortTranslations(actual)).toEqual(sortTranslations(expected))
  })

  test("patch with empty base returns patch", () => {
    const base = {}
    const patch = {
      a: "A",
      b: "B",
    }
    const expected = {
      a: "A",
      b: "B",
    }
    const actual = applyPatch({ base, patch })
    expect(sortTranslations(actual)).toEqual(sortTranslations(expected))
  })

  test("patch with nested removal (should keep base keys not present in patch)", () => {
    const base = {
      a: "A",
      nested: {
        b: "B",
        c: "C",
      },
    }
    const patch = {
      nested: {
        b: "B2",
      },
    }
    const expected = {
      a: "A",
      nested: {
        b: "B2",
        c: "C",
      },
    }
    const actual = applyPatch({ base, patch })
    expect(sortTranslations(actual)).toEqual(sortTranslations(expected))
  })
})
