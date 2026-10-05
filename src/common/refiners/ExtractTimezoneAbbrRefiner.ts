// Map ABBR -> Offset in minute
import { ParsingContext, Refiner } from "../../chrono";
import { AmbiguousTimezoneMap, TimezoneAbbrMap } from "../../types";
import { ParsingResult } from "../../results";
import { getTimezoneDefinition, resolveTimezoneOffset } from "../../timezone";

const TIMEZONE_NAME_PATTERN = new RegExp("^\\s*,?\\s*\\(?([A-Z]{2,4})\\)?(?=\\W|$)", "i");

export default class ExtractTimezoneAbbrRefiner implements Refiner {
    constructor(private readonly timezoneOverrides?: TimezoneAbbrMap) {}

    refine(context: ParsingContext, results: ParsingResult[]): ParsingResult[] {
        const timezoneOverrides = context.option.timezones ?? {};

        results.forEach((result) => {
            const suffix = context.text.substring(result.index + result.text.length);
            const match = TIMEZONE_NAME_PATTERN.exec(suffix);
            if (!match) {
                return;
            }

            const timezoneAbbr = match[1].toUpperCase();
            const refDate = result.start.date() ?? result.refDate ?? new Date();
            const tzOverrides = { ...this.timezoneOverrides, ...timezoneOverrides };
            const timezoneDefinition = getTimezoneDefinition(timezoneAbbr, tzOverrides);
            if (timezoneDefinition == null) {
                return;
            }
            const extractedTimezoneOffset = resolveTimezoneOffset(timezoneDefinition, refDate);
            context.debug(() => {
                console.log(
                    `Extracting timezone: '${timezoneAbbr}' into: ${extractedTimezoneOffset} for: ${result.start}`
                );
            });

            const currentTimezoneOffset = result.start.get("timezoneOffset");
            if (currentTimezoneOffset !== null && extractedTimezoneOffset != currentTimezoneOffset) {
                // We may already have extracted the timezone offset e.g. "11 am GMT+0900 (JST)"
                // - if they are equal, we also want to take the abbreviation text into result
                // - if they are not equal, we trust the offset more
                if (result.start.isCertain("timezoneOffset")) {
                    return;
                }

                // This is often because it's relative time with inferred timezone (e.g. in 1 hour, tomorrow)
                // Then, we want to double-check the abbr case (e.g. "GET" not "get")
                if (timezoneAbbr != match[1]) {
                    return;
                }
            }

            if (result.start.isOnlyDate()) {
                // If the time is not explicitly mentioned,
                // Then, we also want to double-check the abbr case (e.g. "GET" not "get")
                if (timezoneAbbr != match[1]) {
                    return;
                }
            }

            result.text += match[0];

            // Attach the timezone definition itself. For DST-dependent abbreviations (e.g. "ET", "CET"),
            // the offset will be re-resolved against each component's own wall-clock date — including
            // when these components become either end of a date range spanning a DST transition.
            if (!result.start.isCertain("timezoneOffset")) {
                result.start.assign("timezoneOffset", extractedTimezoneOffset);
                result.start.assignTimezoneDefinition(timezoneDefinition);
            }

            if (result.end != null && !result.end.isCertain("timezoneOffset")) {
                // Resolve against the end's own wall-clock date (not its current instant, which may
                // still carry the start's offset) so a DST boundary between the ends is handled correctly.
                const endWallDate = result.end.dayjs().toDate();
                const endTimezoneOffset = resolveTimezoneOffset(timezoneDefinition, endWallDate);
                result.end.assign("timezoneOffset", endTimezoneOffset);
                result.end.assignTimezoneDefinition(timezoneDefinition);
            }
        });

        return results;
    }
}
