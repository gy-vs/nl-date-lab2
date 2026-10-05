import * as chrono from "../src/";
import { testSingleCase } from "./test_util";

// These tests cover DST-dependent timezone abbreviations ("ET", "CT", "PT", "CET", ...) whose correct
// offset depends on the wall-clock date of each parsed point. The assertions use absolute instants,
// so they pass regardless of the machine's system timezone.

test("Test - Timezone abbreviation in text resolves per date across US spring-forward range", function () {
    // US DST 2024 begins on March 10 at 2am: March 9 10pm is EST (-300), March 10 10am is EDT (-240).
    const refDate = new Date("2024-03-01T12:00:00Z");
    testSingleCase(chrono, "March 9, 2024 10pm to March 10, 2024 10am ET", refDate, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-10T03:00:00Z"));
        expect(result.start.get("timezoneOffset")).toBe(-300);
        expect(result.end).toBeDate(new Date("2024-03-10T14:00:00Z"));
        expect(result.end!.get("timezoneOffset")).toBe(-240);
    });

    testSingleCase(chrono, "March 9, 2024 10pm ET", refDate, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-10T03:00:00Z"));
        expect(result.start.get("timezoneOffset")).toBe(-300);
    });

    testSingleCase(chrono, "March 10, 2024 10am ET", refDate, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-10T14:00:00Z"));
        expect(result.start.get("timezoneOffset")).toBe(-240);
    });
});

test("Test - Timezone abbreviation in text resolves per date across US fall-back range", function () {
    // US DST 2024 ends on November 3 at 2am: November 2 9pm is EDT (-240), November 3 9am is EST (-300).
    const refDate = new Date("2024-10-01T12:00:00Z");
    testSingleCase(chrono, "Nov 2, 2024 9pm to Nov 3, 2024 9am ET", refDate, (result) => {
        expect(result.start).toBeDate(new Date("2024-11-03T01:00:00Z"));
        expect(result.start.get("timezoneOffset")).toBe(-240);
        expect(result.end).toBeDate(new Date("2024-11-03T14:00:00Z"));
        expect(result.end!.get("timezoneOffset")).toBe(-300);
    });
});

test("Test - CET abbreviation resolves per date across European fall-back range", function () {
    // European DST 2024 ends on October 27 at 3am (CEST +120 -> CET +60).
    const refDate = new Date("2024-10-01T12:00:00Z");
    testSingleCase(chrono, "Oct 26 2024 20:00 - Oct 27 2024 20:00 CET", refDate, (result) => {
        expect(result.start).toBeDate(new Date("2024-10-26T18:00:00Z"));
        expect(result.start.get("timezoneOffset")).toBe(120);
        expect(result.end).toBeDate(new Date("2024-10-27T19:00:00Z"));
        expect(result.end!.get("timezoneOffset")).toBe(60);
    });
});

test("Test - Timezone abbreviation on the earlier side of a range also propagates correctly", function () {
    const refDate = new Date("2024-03-01T12:00:00Z");
    testSingleCase(chrono, "March 9, 2024 10pm ET to March 10, 2024 10am", refDate, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-10T03:00:00Z"));
        expect(result.start.isCertain("timezoneOffset")).toBe(true);
        expect(result.end).toBeDate(new Date("2024-03-10T14:00:00Z"));
        expect(result.end!.isCertain("timezoneOffset")).toBe(false);
    });
});

test("Test - Fixed-offset abbreviations remain fixed across a DST range", function () {
    const refDate = new Date("2024-03-01T12:00:00Z");
    testSingleCase(chrono, "March 9, 2024 10pm to March 10, 2024 10am EST", refDate, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-10T03:00:00Z"));
        expect(result.end).toBeDate(new Date("2024-03-10T15:00:00Z"));
        expect(result.start.get("timezoneOffset")).toBe(-300);
        expect(result.end!.get("timezoneOffset")).toBe(-300);
    });
});

test("Test - Reference timezone abbreviation resolves against the parsed date (US spring)", function () {
    const reference = { instant: new Date("2024-03-09T17:00:00Z"), timezone: "ET" };
    testSingleCase(chrono, "tomorrow at 10am", reference, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-10T14:00:00Z"));
    });
    testSingleCase(chrono, "March 10, 2024 10am", reference, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-10T14:00:00Z"));
    });
    testSingleCase(chrono, "Sunday 9am", reference, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-10T13:00:00Z"));
    });
});

test("Test - Reference timezone abbreviation resolves against the parsed date (US fall)", function () {
    const reference = { instant: new Date("2024-11-02T17:00:00Z"), timezone: "ET" };
    testSingleCase(chrono, "tomorrow at 10am", reference, (result) => {
        expect(result.start).toBeDate(new Date("2024-11-03T15:00:00Z"));
    });
});

test("Test - Reference CET abbreviation resolves against the parsed date (European fall)", function () {
    const reference = { instant: new Date("2024-10-26T17:00:00Z"), timezone: "CET" };
    testSingleCase(chrono, "tomorrow at 10am", reference, (result) => {
        expect(result.start).toBeDate(new Date("2024-10-27T09:00:00Z"));
    });
});

test("Test - Duration-based expressions keep the reference instant's offset", function () {
    // "in 2 days" is a duration from the reference instant (which is still in EST), so it keeps -300.
    const reference = { instant: new Date("2024-03-09T17:00:00Z"), timezone: "ET" };
    testSingleCase(chrono, "in 2 days", reference, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-11T17:00:00Z"));
    });
});

test("Test - Numeric reference timezone keeps fixed-offset behavior across DST", function () {
    const reference = { instant: new Date("2024-03-09T17:00:00Z"), timezone: -300 };
    testSingleCase(chrono, "tomorrow at 10am", reference, (result) => {
        // Fixed -5h offset regardless of the actual DST change.
        expect(result.start).toBeDate(new Date("2024-03-10T15:00:00Z"));
    });
});

test("Test - Custom timezone overrides apply across a DST range", function () {
    const refDate = new Date("2024-03-01T12:00:00Z");
    const option = { timezones: { ET: 330 } };
    testSingleCase(chrono, "March 9, 2024 10pm to March 10, 2024 10am ET", refDate, option, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-09T16:30:00Z"));
        expect(result.end).toBeDate(new Date("2024-03-10T04:30:00Z"));
        expect(result.start.get("timezoneOffset")).toBe(330);
        expect(result.end!.get("timezoneOffset")).toBe(330);
    });
});

test("Test - Custom DST-dependent timezone override resolves per date", function () {
    const refDate = new Date("2024-03-01T12:00:00Z");
    const option = {
        timezones: {
            XET: {
                timezoneOffsetDuringDst: -4 * 60,
                timezoneOffsetNonDst: -5 * 60,
                dstStart: (year: number) => new Date(year, 2, 10, 2),
                dstEnd: (year: number) => new Date(year, 10, 3, 2),
            },
        },
    };
    testSingleCase(chrono, "March 9, 2024 10pm to March 10, 2024 10am XET", refDate, option, (result) => {
        expect(result.start).toBeDate(new Date("2024-03-10T03:00:00Z"));
        expect(result.start.get("timezoneOffset")).toBe(-300);
        expect(result.end).toBeDate(new Date("2024-03-10T14:00:00Z"));
        expect(result.end!.get("timezoneOffset")).toBe(-240);
    });
});
