import * as chrono from "../src/";
import { testSingleCase } from "./test_util";

test("Test - Using reference with timezone", function () {
    testSingleCase(
        chrono,
        "Friday at 4pm",
        {
            instant: new Date("Wed Jun 09 2021 07:00:00 GMT-0500 (CDT)"),
            timezone: "CDT",
        },
        (result) => {
            expect(result).toBeDate(new Date("Fri Jun 11 2021 16:00:00 GMT-0500 (CDT)"));
            expect(result).toBeDate(new Date("Sat Jun 12 2021 06:00:00 GMT+0900 (JST)"));
        }
    );
    testSingleCase(
        chrono,
        "1am",
        {
            instant: new Date("Wed May 26 2022 01:57:00 GMT-0500 (CDT)"),
            timezone: "CDT",
        },
        (result) => {
            expect(result.start.get("year")).toBe(2022);
            expect(result.start.get("month")).toBe(5);
            expect(result.start.get("day")).toBe(26);
            expect(result.start.get("hour")).toBe(1);
        }
    );
});

test("Test - Using reference with missing/default timezone", function () {
    const INPUT = "Friday at 4pm";
    const REF_INSTANT = new Date(2021, 6 - 1, 9, 7, 0, 0);
    const EXPECTED_INSTANT = new Date(2021, 6 - 1, 11, 16, 0, 0);

    testSingleCase(chrono, INPUT, REF_INSTANT, (result) => {
        expect(result).toBeDate(EXPECTED_INSTANT);
    });

    testSingleCase(chrono, INPUT, { instant: REF_INSTANT }, (result) => {
        expect(result).toBeDate(EXPECTED_INSTANT);
    });

    testSingleCase(chrono, INPUT, { instant: REF_INSTANT, timezone: null }, (result) => {
        expect(result).toBeDate(EXPECTED_INSTANT);
    });

    testSingleCase(chrono, INPUT, { instant: REF_INSTANT, timezone: "" }, (result) => {
        expect(result).toBeDate(EXPECTED_INSTANT);
    });
});

test("Test - Using reference instance with different timezone", function () {
    // Sun Jun 06 2021 19:00:00 GMT+0900 (JST)
    // Sun Jun 06 2021 11:00:00 GMT+0100 (BST)
    const refInstant = new Date("Sun Jun 06 2021 19:00:00 GMT+0900 (JST)");

    // "At 4pm tomorrow" at "Sun Jun 06 2021 11:00:00 (BST)"
    testSingleCase(chrono, "At 4pm tomorrow", { instant: refInstant, timezone: "BST" }, (result) => {
        const expectedInstant = new Date("Mon Jun 07 2021 16:00:00 GMT+0100 (BST)");
        expect(result).toBeDate(expectedInstant);
    });

    // "At 4pm tomorrow" at "Sun Jun 06 2021 19:00:00 (JST)"
    testSingleCase(chrono, "At 4pm tomorrow", { instant: refInstant, timezone: "JST" }, (result) => {
        const expectedInstant = new Date("Mon Jun 07 2021 16:00:00 GMT+0900 (JST)");
        expect(result).toBeDate(expectedInstant);
    });
});

test("Test - Using reference instance with custom timezones", function () {
    // Sun Jun 06 2021 19:00:00 GMT+0900 (JST)
    // Sun Jun 06 2021 11:00:00 GMT+0100 (BST)
    const refInstant = new Date("Sun Jun 06 2021 19:00:00 GMT+0900 (JST)");

    // Fictional timezones
    const timezones = {
        "JJJ": 540, // JJJ => GMT+0900 JST
        "BBB": 60, // BBB => GMT+0100 BST
    };

    // "At 4pm tomorrow" at "Sun Jun 06 2021 11:00:00 (BBB = BST)"
    testSingleCase(
        chrono,
        "At 4pm tomorrow",
        { instant: refInstant, timezone: "BBB" },
        { timezones: timezones },
        (result) => {
            const expectedInstant = new Date("Mon Jun 07 2021 16:00:00 GMT+0100 (BST)");
            expect(result).toBeDate(expectedInstant);
        }
    );

    // "At 4pm tomorrow" at "Sun Jun 06 2021 19:00:00 (JJJ = JST)"
    testSingleCase(
        chrono,
        "At 4pm tomorrow",
        { instant: refInstant, timezone: "JJJ" },
        { timezones: timezones },
        (result) => {
            const expectedInstant = new Date("Mon Jun 07 2021 16:00:00 GMT+0900 (JST)");
            expect(result).toBeDate(expectedInstant);
        }
    );
});

test("Test - Timezone difference on reference date #2", function () {
    const refInstant = new Date("2024-02-21T10:00:00+1300");

    testSingleCase(chrono, "yesterday 18:00", { instant: refInstant, timezone: 780 }, (result) => {
        // expect(result.start.get("year")).toBe(2024);
        // expect(result.start.get("month")).toBe(2);
        // expect(result.start.get("day")).toBe(20);
        // expect(result).toBeDate(new Date("2024-02-20T18:00:00+1300"));
    });
});

test("Test - Timezone difference on written date", function () {
    // Sun Jun 06 2021 19:00:00 GMT+0900 (JST)
    // Sun Jun 06 2021 11:00:00 GMT+0100 (BST)
    const refInstant = new Date("Sun Jun 06 2021 19:00:00 GMT+0900 (JST)");

    testSingleCase(chrono, "Sun Jun 06 2021 19:00:00", { timezone: "JST" }, (result) => {
        expect(result).toBeDate(refInstant);
    });

    testSingleCase(chrono, "Sun Jun 06 2021 11:00:00", { timezone: "BST" }, (result) => {
        expect(result).toBeDate(refInstant);
    });

    testSingleCase(chrono, "Sun Jun 06 2021 11:00:00", { timezone: 60 }, (result) => {
        expect(result).toBeDate(refInstant);
    });
});

test("Test - DST-dependent reference timezone is resolved at the mentioned date", function () {
    // US spring forward: 2024-03-10 at 02:00 local time.
    // The reference (Saturday noon) is still standard time, but the mentioned Sunday is DST.
    const springRef = { instant: new Date("2024-03-09T17:00:00Z"), timezone: "ET" };

    testSingleCase(chrono, "tomorrow at 10am", springRef, (result) => {
        expect(result).toBeDate(new Date("2024-03-10T14:00:00Z"));
    });

    testSingleCase(chrono, "March 10, 2024 10am", springRef, (result) => {
        expect(result).toBeDate(new Date("2024-03-10T14:00:00Z"));
    });

    testSingleCase(chrono, "Sunday 9am", springRef, (result) => {
        expect(result).toBeDate(new Date("2024-03-10T13:00:00Z"));
    });

    // US fall back: 2024-11-03 at 02:00 local time. The reference (Saturday noon) is still DST.
    const fallRef = { instant: new Date("2024-11-02T17:00:00Z"), timezone: "ET" };

    testSingleCase(chrono, "tomorrow at 10am", fallRef, (result) => {
        expect(result).toBeDate(new Date("2024-11-03T15:00:00Z"));
    });

    // Europe fall back: 2024-10-27 at 03:00 local time.
    const europeFallRef = { instant: new Date("2024-10-26T17:00:00Z"), timezone: "CET" };

    testSingleCase(chrono, "tomorrow 10am", europeFallRef, (result) => {
        expect(result).toBeDate(new Date("2024-10-27T09:00:00Z"));
    });
});

test("Test - Durations keep the reference instant offset across DST", function () {
    const springRef = { instant: new Date("2024-03-09T17:00:00Z"), timezone: "ET" };

    // "in 2 days" is a calendar-day duration: both running modes agreed on it before the fix.
    testSingleCase(chrono, "in 2 days", springRef, (result) => {
        expect(result).toBeDate(new Date("2024-03-11T17:00:00Z"));
    });

    // "in 3 hours" is an elapsed duration and must not jump with the clock change.
    testSingleCase(chrono, "in 3 hours", { instant: new Date("2024-03-10T03:00:00Z"), timezone: "ET" }, (result) => {
        expect(result).toBeDate(new Date("2024-03-10T06:00:00Z"));
    });
});

test("Test - Fixed/numeric reference timezones are unaffected by DST dates", function () {
    const springRef = { instant: new Date("2024-03-09T17:00:00Z"), timezone: -300 };

    testSingleCase(chrono, "tomorrow at 10am", springRef, (result) => {
        expect(result).toBeDate(new Date("2024-03-10T15:00:00Z"));
    });

    // A fixed custom abbreviation definition is used as-is on both sides of the transition.
    testSingleCase(
        chrono,
        "tomorrow at 10am",
        { instant: new Date("2024-03-09T17:00:00Z"), timezone: "ET" },
        { timezones: { ET: -200 } },
        (result) => {
            expect(result).toBeDate(new Date("2024-03-10T13:20:00Z"));
        }
    );
});

test("Test - Precise [now] mentioned", function () {
    const refDate = new Date("Sat Mar 13 2021 14:22:14 GMT+0900 (Japan Standard Time)");

    testSingleCase(chrono, "now", refDate, (result) => {
        expect(result).toBeDate(refDate);
    });

    testSingleCase(chrono, "now", { instant: refDate }, (result) => {
        expect(result).toBeDate(refDate);
    });

    testSingleCase(chrono, "now", { instant: refDate, timezone: 540 }, (result) => {
        expect(result).toBeDate(refDate);
    });

    testSingleCase(chrono, "now", { instant: refDate, timezone: "JST" }, (result) => {
        expect(result).toBeDate(refDate);
    });

    testSingleCase(chrono, "now", { instant: refDate, timezone: -300 }, (result) => {
        expect(result).toBeDate(refDate);
    });
});

test("Test - Precise date/time mentioned", function () {
    const text = "Sat Mar 13 2021 14:22:14 GMT+0900";
    const refDate = new Date();

    testSingleCase(chrono, text, refDate, (result, text) => {
        expect(result).toBeDate(new Date(text));
    });

    testSingleCase(chrono, text, { instant: refDate }, (result) => {
        expect(result).toBeDate(new Date(text));
    });

    testSingleCase(chrono, text, { instant: refDate, timezone: 540 }, (result) => {
        expect(result).toBeDate(new Date(text));
    });

    testSingleCase(chrono, text, { instant: refDate, timezone: "JST" }, (result) => {
        expect(result).toBeDate(new Date(text));
    });

    testSingleCase(chrono, text, { instant: refDate, timezone: -300 }, (result) => {
        expect(result).toBeDate(new Date(text));
    });
});
