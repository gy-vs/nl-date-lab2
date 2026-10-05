/*

*/

import { ParsingContext } from "../../chrono";
import { ParsingComponents, ParsingResult } from "../../results";
import { MergingRefiner } from "../abstractRefiners";
import { addDuration } from "../../calculation/duration";
import { findTimezoneDefinition, toTimezoneOffset } from "../../timezone";

const TRAILING_TIMEZONE_NAME_PATTERN = new RegExp("\\(?([A-Za-z]{2,4})\\)?\\s*$");

/**
 * A date range can end with a daylight-saving dependent timezone abbreviation (e.g.
 * "March 9, 2024 10pm to March 10, 2024 10am ET"). The timezone offset is extracted before the
 * range results are merged, so one side may receive the other side's offset through component
 * implication. This re-evaluates the offset for each side against its own (wall-clock) date.
 *
 * Only offsets that were merely implied are touched: explicitly mentioned timezones (e.g. EST,
 * EDT, JST) and fixed/numeric offsets are left untouched.
 */
function reimplyAmbiguousTimezoneOffsets(result: ParsingResult, context: ParsingContext): void {
    if (result.end == null) {
        return;
    }

    const match = TRAILING_TIMEZONE_NAME_PATTERN.exec(result.text);
    if (!match) {
        return;
    }

    const timezoneOverrides = context.option.timezones ?? {};
    const timezoneAbbr = match[1].toUpperCase();
    const timezoneDefinition = findTimezoneDefinition(timezoneAbbr, timezoneOverrides);
    if (timezoneDefinition == null || typeof timezoneDefinition !== "object") {
        // A fixed/numeric offset (or an unrecognized suffix) is the same for both sides.
        return;
    }
    const ambiguousTimezone = timezoneDefinition;

    // Only act when the abbreviation was actually extracted as this timezone: one side must carry
    // its offset as a certain value. This also avoids acting on words that merely look like a
    // timezone abbreviation.
    const hasCertainMatchingOffset = [result.start, result.end].some(
        (components) =>
            components.isCertain("timezoneOffset") &&
            (components.get("timezoneOffset") === ambiguousTimezone.timezoneOffsetDuringDst ||
                components.get("timezoneOffset") === ambiguousTimezone.timezoneOffsetNonDst)
    );
    if (!hasCertainMatchingOffset) {
        return;
    }

    const reimplyOffsetIfMatching = (components: ParsingComponents) => {
        if (components.isCertain("timezoneOffset")) {
            return;
        }

        const currentOffset = components.get("timezoneOffset");
        if (
            currentOffset != null &&
            currentOffset !== ambiguousTimezone.timezoneOffsetDuringDst &&
            currentOffset !== ambiguousTimezone.timezoneOffsetNonDst
        ) {
            // The implied offset belongs to some other timezone, not the trailing abbreviation.
            return;
        }

        // Evaluate DST/non-DST against the component's own stated date and time.
        const wallDate = components.dayjs().toDate();
        const correctOffset = toTimezoneOffset(timezoneAbbr, wallDate, timezoneOverrides);
        if (correctOffset != null) {
            components.imply("timezoneOffset", correctOffset);
        }
    };

    reimplyOffsetIfMatching(result.start);
    reimplyOffsetIfMatching(result.end);
}

export default abstract class AbstractMergeDateRangeRefiner extends MergingRefiner {
    abstract patternBetween(): RegExp;

    shouldMergeResults(textBetween, currentResult, nextResult): boolean {
        return !currentResult.end && !nextResult.end && textBetween.match(this.patternBetween()) != null;
    }

    mergeResults(textBetween, fromResult, toResult, context): ParsingResult {
        if (!fromResult.start.isOnlyWeekdayComponent() && !toResult.start.isOnlyWeekdayComponent()) {
            toResult.start.getCertainComponents().forEach((key) => {
                if (!fromResult.start.isCertain(key)) {
                    fromResult.start.imply(key, toResult.start.get(key));
                }
            });

            fromResult.start.getCertainComponents().forEach((key) => {
                if (!toResult.start.isCertain(key)) {
                    toResult.start.imply(key, fromResult.start.get(key));
                }
            });
        }
        if (fromResult.start.date() > toResult.start.date()) {
            let fromDate = fromResult.start.date();
            let toDate = toResult.start.date();

            if (toResult.start.isOnlyWeekdayComponent() && addDuration(toDate, { day: 7 }) > fromDate) {
                toDate = addDuration(toDate, { day: 7 });
                toResult.start.imply("day", toDate.getDate());
                toResult.start.imply("month", toDate.getMonth() + 1);
                toResult.start.imply("year", toDate.getFullYear());
            } else if (fromResult.start.isOnlyWeekdayComponent() && addDuration(fromDate, { day: -7 }) < toDate) {
                fromDate = addDuration(fromDate, { day: -7 });
                fromResult.start.imply("day", fromDate.getDate());
                fromResult.start.imply("month", fromDate.getMonth() + 1);
                fromResult.start.imply("year", fromDate.getFullYear());
            } else if (toResult.start.isDateWithUnknownYear() && addDuration(toDate, { year: 1 }) > fromDate) {
                toDate = addDuration(toDate, { year: 1 });
                toResult.start.imply("year", toDate.getFullYear());
            } else if (fromResult.start.isDateWithUnknownYear() && addDuration(fromDate, { year: -1 }) < toDate) {
                fromDate = addDuration(fromDate, { year: -1 });
                fromResult.start.imply("year", fromDate.getFullYear());
            } else {
                [toResult, fromResult] = [fromResult, toResult];
            }
        }
        const result = fromResult.clone();
        result.start = fromResult.start;
        result.end = toResult.start;
        result.index = Math.min(fromResult.index, toResult.index);
        if (fromResult.index < toResult.index) {
            result.text = fromResult.text + textBetween + toResult.text;
        } else {
            result.text = toResult.text + textBetween + fromResult.text;
        }

        reimplyAmbiguousTimezoneOffsets(result, context);
        return result;
    }
}
